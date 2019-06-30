import _ from "lodash";
import {
  Request,
  DataNode,
  Cache,
  StateNode,
  PluginManager,
  Messager
} from ".";
import { AxiosPromise } from "axios";
import {
  IDataNode,
  IStateNode,
  IUINode,
  ILayoutSchema,
  IRequest,
  IErrorInfo,
  IPluginManager,
  IMessager
} from "../../typings";

export default class UINode implements IUINode {
  private request: IRequest = new Request();
  dataNode: IDataNode;
  stateNode: IStateNode = new StateNode(this);
  children: Array<UINode> = [];
  pluginManager: IPluginManager = new PluginManager(this);
  errorInfo: IErrorInfo = {};
  schema: ILayoutSchema = {};
  rootName: string = "";
  isLiveChildren: boolean = false;
  id: string = "";
  messager: IMessager;
  props: object = {};
  parent?: IUINode;

  constructor(
    schema: ILayoutSchema,
    request?: IRequest,
    root: string = "",
    parent?: IUINode
  ) {
    if (request) {
      this.request = request;
    }
    this.schema = schema;

    // cache root object if given root name
    if (root) {
      this.rootName = root;
    }

    // initial id, the id can't change
    if (!this.schema._id) {
      this.schema._id = _.uniqueId("node-");
    }
    this.id = this.schema._id;

    // new messager
    this.messager = new Messager(this.schema._id);

    // assign parent
    this.parent = parent;

    // data node initial
    this.dataNode = new DataNode(schema.datasource || "", this, this.request);
  }

  async loadLayout(schema?: ILayoutSchema | string) {
    // load remote node
    let returnSchema: any = schema;
    if (!returnSchema) returnSchema = this.schema;
    if (typeof schema === "string" && schema) {
      returnSchema = await this.loadRemoteLayout(schema);
      if (!this.rootName) this.rootName = schema;
    }
    // assign the schema to this and it's children
    if (returnSchema) {
      await this.assignSchema(returnSchema);
    }

    // cache this node
    Cache.setUINode(this.rootName, this);
    return returnSchema;
  }

  getSchema(path?: string): ILayoutSchema {
    // if (_.isEmpty(this.schema)) {
    //   console.warn("did you execute loadLayout before using getSchema method?");
    // }
    if (path) {
      return _.get(this.schema, path);
    }
    return this.schema;
  }

  getErrorInfo(): IErrorInfo {
    return this.errorInfo;
  }

  getDataNode() {
    return this.dataNode;
  }

  getStateNode(): IStateNode {
    return this.stateNode;
  }

  getPluginManager(): IPluginManager {
    return this.pluginManager;
  }

  getRequest(): IRequest {
    return this.request;
  }

  async loadRemoteLayout(url: string): Promise<AxiosPromise> {
    let result: any = Cache.getLayoutSchema(url);
    if (!result) {
      try {
        let response: any = await this.request.get(url);
        if (response.data) {
          result = response.data;
          Cache.setLayoutSchema(url, result);
        }
      } catch (e) {
        this.errorInfo = {
          status: 400,
          code: `Error loading from ${url}`
        };
      }
    }
    return result;
  }

  /**
   * TO DO: need to enhance:
   * 1. if only state change, on layout gen
   * 2. if data change, if the changed data has an item different than origin one, should renew the one, if delete one, should also remove the one
   * @param schema
   * @param reloadData
   */
  private async assignSchema(
    schema: ILayoutSchema,
    reloadData: boolean = true
  ) {
    let liveSchema = schema;
    if (
      liveSchema["datasource"] &&
      !_.startsWith(liveSchema["datasource"], "$dummy") &&
      reloadData
    ) {
      await this.loadData(liveSchema["datasource"]);
    }

    if (liveSchema["$children"] && this.dataNode) {
      const data = this.dataNode.getData();
      liveSchema = await this.genLiveLayout(liveSchema, data);
    }

    if (liveSchema.children) {
      const children: any = [];
      for (let index in liveSchema.children) {
        let node: any;
        let s: any = liveSchema.children[index];
        if (_.isArray(s)) {
          node = new UINode({}, this.request, this.rootName, this);
          for (let i in s) {
            const subnode = new UINode(s[i], this.request, this.rootName, this);
            await subnode.loadLayout(s[i]);
            node.children.push(subnode);
          }
        } else {
          node = new UINode(s, this.request, this.rootName, this);
          await node.loadLayout(s);
        }
        children.push(node);
      }
      this.children = children;
    }

    this.schema = liveSchema;
    // load State
    this.stateNode = new StateNode(this);
    await this.stateNode.renewStates();
    // console.log(
    //   this.id,
    //   this.dataNode.data,
    //   this.stateNode.state,
    //   ".......... state on UINODE......"
    // );
    // load ui.parser plugin
    try {
      await this.pluginManager.executePlugins("ui.parser");
    } catch (e) {
      console.log(e.message);
    }
    return this;
  }

  async loadData(source: string) {
    const result: any = await this.dataNode.loadData(source);
    return result;
  }

  async replaceLayout(newSchema: ILayoutSchema | string) {
    this.clearLayout();
    const schemaReplaced = await this.loadLayout(newSchema);
    return schemaReplaced;
  }

  async updateLayout() {
    const newSchema = await this.assignSchema(this.schema, false);
    return newSchema;
  }

  clearLayout() {
    Cache.clearUINodes(this.rootName);
    this.schema = {};
    this.errorInfo = {};
    this.children = [];
    this.rootName = "";
    this.isLiveChildren = false;
    this.id = "";
    return this;
  }

  getNode(path?: string) {
    if (path) {
      return _.get(this, path);
    }
    return this;
  }

  getChildren(route?: Array<Number>) {
    // if (_.isEmpty(this.children)) {
    //   console.warn(
    //     "did you execute loadLayout before using getChildren method?"
    //   );
    // }
    if (route) {
      const path = route.map((v: Number) => {
        return `children[${v}]`;
      });
      return _.get(this, path.join("."));
    } else {
      return this.children;
    }
  }

  searchNodes(prop: object, layoutId?: string): any {
    let nodes: Array<any> = [];

    const rootName = layoutId || this.rootName;
    let allUINodes = Cache.getUINode(rootName) as IUINode;
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
          const schemaValue = _.get(schema, name);
          if (v !== schemaValue) {
            finded = false;
            return;
          }
        });
        if (finded) {
          nodes.push(target);
        }
      });
    }
    return nodes;
  }

  searchDepsNodes(myNode?: IUINode, layoutId?: string) {
    let schema: ILayoutSchema;
    if (!myNode) {
      schema = this.getSchema();
    } else {
      schema = myNode.getSchema();
    }

    let root = layoutId;
    let nodes: Array<any> = [];
    // to fix: rootName should not be empty
    if (!root) root = this.rootName || "default";
    let allUINodes = Cache.getUINode(root) as IUINode;
    _.forIn(allUINodes, (node: IUINode) => {
      const sch = node.getSchema();
      if (sch.state) {
        _.forIn(sch.state, (state: any, key: string) => {
          if (state.deps) {
            _.forEach(state.deps, (dep: any) => {
              if (dep.selector) {
                let finded = false;
                //k=id, v:id-of-demo-element-1
                _.forIn(dep.selector, (v: any, k: any) => {
                  if (!schema[k] || v !== schema[k]) {
                    finded = false;
                    return;
                  } else {
                    finded = true;
                  }
                });
                if (finded) {
                  nodes.push(node);
                }
              }
            });
          }
        });
      }
    });
    return nodes;
  }

  async genLiveLayout(schema: ILayoutSchema, data: any) {
    if (schema.datasource) {
      data = await this.loadData(schema.datasource);
    }

    // replace $ to row number
    const updatePropRow = (target: ILayoutSchema, index: string) => {
      _.forIn(target, function(value: any, key: string) {
        if (typeof value === "object") {
          updatePropRow(value, index);
        } else if (_.isString(value) && value.indexOf("$") > -1) {
          _.set(target, key, value.replace("$", index));
        }
      });
    };

    const liveSchema = schema;
    const rowTemplate: any = liveSchema.$children;
    if (rowTemplate && data) {
      liveSchema.children = data.map((d: any, index: string) =>
        rowTemplate.map((s: any) => {
          const newSchema = _.cloneDeep(s);
          if (newSchema.datasource) {
            updatePropRow(newSchema, index);
            newSchema._index = index; // row id
          }
          return newSchema;
        })
      );
    }

    // add a new children
    this.isLiveChildren = true;
    return liveSchema;
  }

  async updateState() {
    return await this.getStateNode().renewStates();
  }
}
