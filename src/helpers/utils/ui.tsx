import React from "react";
import _ from "lodash";

import { UIEngineRegister, Cache } from "../";
import {
  ICacheBlock,
  ICachePiece,
  IUINode,
  IUISchema,
  IPluginExecuteOption,
} from "../../../typings";

/**
 * From schema define, get registered components
 * @param componentLine like antd:Component
 */
export function getComponent(componentLine?: string) {
  let WrappedComponent: any;
  if (!componentLine) {
    WrappedComponent = (props: any) => props.children || null;
  } else {
    // get registered component
    const componentMap = UIEngineRegister.componentsLibrary;
    let [packageName, component] = componentLine.split(":");
    const defaultComponent = (props: any) => {
      const { children, uinode, ...rest } = props;
      return React.createElement(packageName, rest, children);
    };

    // the lineage like 'div', 'a'
    if (!component) {
      WrappedComponent = defaultComponent;
    } else {
      if (component.indexOf(".") > -1) {
        const [com, sub] = component.split(".");
        WrappedComponent = _.get(componentMap, `${packageName}.${com}`);
        if (WrappedComponent) {
          WrappedComponent = _.get(WrappedComponent, sub);
        } else {
          WrappedComponent = defaultComponent;
        }
      } else {
        WrappedComponent = _.get(componentMap, `${packageName}.${component}`);
      }
    }
  }
  return WrappedComponent;
}

/**
 * Search UINodes which has the search condition props
 *
 * @param prop the schema defined props
 *  example:
 *           { datasource: /^slb.virtual-server:/} will match by regexp
 *            or string
 *           { datasource: 'slb.virtual-server:name}
 *            or callback allowed
 *           { datasource: (schemaValue) => {}}
 * @param rootName the root name of the loaded schema nodes
 * @return UINodes has the props
 */
export function searchNodes(prop: object, layoutKey?: string) {
  let nodes: Array<any> = [];
  // const rootName = parseRootName(layout);

  let allUINodes = {};
  if (_.isString(layoutKey) && layoutKey) {
    allUINodes = Cache.getLayoutNode(layoutKey, { allCacheKeys: true });
  } else {
    // if rootName not provided, merge all nodes, and search from
    const nodeBlock: ICacheBlock = Cache.getLayoutNode();
    _.forIn(nodeBlock, (node: ICachePiece, layoutKey: string) => {
      allUINodes = _.assign(allUINodes, node.subPieces);
    });
  }

  if (_.isObject(allUINodes)) {
    _.forIn(allUINodes, (target: any, id: string) => {
      if (!target.getSchema) return;
      let finded = true;
      const schema = target.getSchema();
      _.forIn(prop, (v: any, name: string) => {
        // handle name with $
        if (name.indexOf("$") > -1 && schema._index !== undefined) {
          name = name.replace("$", schema._index);
        }

        let schemaValue = _.get(schema, name);
        // add special rule to search datasource
        // since datasource could be { source: 'a.b.c' } or 'a.b.c'
        if (name === "datasource" && _.isObject(schemaValue)) {
          schemaValue = _.get(schemaValue, "source");
        }

        if (v instanceof RegExp) {
          finded = v.test(schemaValue);
        } else if (v !== schemaValue) {
          finded = false;
        } else if (typeof v === "function") {
          finded = v(schemaValue);
        }
        if (!finded) return;
      });
      if (finded) {
        nodes.push(target);
      }
    });
  }
  return nodes;
}

/**
 * Search the nodes who depend on the target
 * A => Dep => B(targetNode)
 *
 * @param targetNode depend on the node
 * @returns An array of UINodes which depend on target
 */
export function searchDepsNodes(targetNode: IUINode) {
  const layoutKey = targetNode.layoutKey;

  const depNodes: IUINode[] = [];
  // to fix: rootName should not be empty
  if (_.isString(layoutKey) && layoutKey) {
    const allUINodes: { [nodeId: string]: IUINode } = Cache.getLayoutNode(layoutKey, { allCacheKeys: true });
    _.forIn(allUINodes, (node: IUINode, key: string) => {
      if (isDependantNode(node, targetNode)) {
        depNodes.push(node);
      }
    });
  }
  return depNodes;
}

/**
 * For using clone table schema purpose
 *
 * @param schema
 */
export function cloneTemplateSchema(schema: IUISchema) {
  _.forIn(schema, (s: any, k: any) => {
    if (_.isString(k) && k[0] === "_") {
      _.unset(schema, k);
    } else if (_.isObject(s) || _.isArray(s)) {
      cloneTemplateSchema(s);
    }
  });
  return schema;
}

/**
 * Whether the node depends on target node
 *
 * @param node
 * @param targetNode
 * @returns true, if depend on the target
 */
function isDependantNode(node: IUINode, targetNode: IUINode) {
  const schema = node.getSchema();
  const targetSchema = targetNode.getSchema();

  let isDepNode: boolean = false;
  if (!_.isNil(targetSchema) && !_.isNil(schema)) {
    const { state } = schema
    if (!_.isEmpty(state)) {
      _.forIn(state, (condition: any, stateName: string) => {
        if (matchOneSelector(condition, targetSchema)) {
          isDepNode = true;
        }
      });
    }
  }
  return isDepNode;
}

/**
 * Whether the target schema matches one selector in the condition
 *
 * @param condition
 * @param targetSchema
 * @returns true, if matches any one
 */
function matchOneSelector(condition: any, targetSchema: IUISchema) {
  const { deps, selector } = condition;

  let isMatched: boolean = false;
  if (!_.isEmpty(deps)) {
    _.forEach(deps, (depCondition: any) => {
      if (matchOneSelector(depCondition, targetSchema)) {
        isMatched = true;
      }
    });
  } else if (!_.isEmpty(selector)) {
    let isEqual = true;
    _.forIn(selector, (expectValue: any, key: any) => {
      const actualValue = _.get(targetSchema, key);
      if (actualValue !== expectValue) {
        isEqual = false;
      }
    });
    if (isEqual) {
      isMatched = true;
    }
  }
  return isMatched;
}
