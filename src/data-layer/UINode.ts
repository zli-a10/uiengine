import _ from "lodash";
import { Request, DataNode, Cache } from ".";
import { AxiosPromise } from "axios";
import { IDataNode } from "../../typings/DataNode";
// import { IUINode, ILayoutSchema } from "../../typings/UINode";

export default class UINode implements IUINode {
  private errorInfo: IErrorInfo = {};
  private request: IRequest = new Request();
  private children: Array<UINode> = [];
  private schema: ILayoutSchema = {};
  private rootLiveSchemas: object = {};
  private dataNode?: any;

  constructor(schema: ILayoutSchema, request?: IRequest) {
    if (request) {
      this.request = request;
    }

    this.schema = schema;
  }

  async loadLayout(schema?: ILayoutSchema | string) {
    let returnSchema: any = schema;
    if (!returnSchema) returnSchema = this.schema;
    let rootSchemaName: string = "";
    if (typeof schema === "string") {
      returnSchema = await this.loadRemoteLayout(schema);
      rootSchemaName = schema;
    }
    await this.assignSchema(returnSchema, rootSchemaName);
    return returnSchema;
  }

  getSchema(): ILayoutSchema {
    return this.schema;
  }

  getErrorInfo(): IErrorInfo {
    return this.errorInfo;
  }

  getChildren(): Array<IUINode> {
    return this.children;
  }

  getDataNode(): IDataNode {
    return this.dataNode;
  }

  getRootLiveSchemas(name?: string) {
    if (name) {
      return this.rootLiveSchemas[name];
    }
    return this.rootLiveSchemas;
  }

  async loadRemoteLayout(url: string): Promise<AxiosPromise> {
    let result: any = Cache.getLayoutSchema(url);
    if (!result) {
      try {
        let response: any = await this.request.get(url);
        if (response.data) {
          result = response.data;
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

  private async assignSchema(
    schema: ILayoutSchema,
    rootSchemaName: string = ""
  ) {
    let liveSchema = schema;
    if (liveSchema["datasource"]) {
      await this.loadData(liveSchema["datasource"]);
    }

    if (liveSchema["$children"]) {
      const data = this.getDataNode().getData();
      ////////////// SCHEMA SWITCHED TO LIVE schema//////
      liveSchema = await this.genLiveLayout(schema, data);
    }

    if (liveSchema.children) {
      this.children = liveSchema.children.map((s: any) => {
        let node: any;
        if (_.isArray(s)) {
          node = _.map(s, (v: ILayoutSchema) => {
            const subnode = new UINode(v);
            // subnode.loadLayout(v);
            return subnode;
          });
        } else {
          node = new UINode(s);
          // node.loadLayout(s);
        }
        return node;
      });
    }

    this.schema = liveSchema;
    if (rootSchemaName) this.rootLiveSchemas[rootSchemaName] = liveSchema;
    return this;
  }

  async loadData(source: string) {
    this.dataNode = new DataNode(source, this.request);
    const result = await this.dataNode.loadData();
    return result;
  }

  async replaceLayout(newSchema: ILayoutSchema | string) {
    this.clearLayout();
    const schemaReplaced = await this.loadLayout(newSchema);
    return schemaReplaced;
  }

  async updateLayout() {
    const newSchema = await this.loadLayout(this.schema);
    return newSchema;
  }

  clearLayout() {
    this.schema = {};
    this.errorInfo = {};
    this.children = [];
    return this;
  }

  getNode(path?: string) {
    if (path) {
      return _.get(this, path);
    }
    return this;
  }

  async genLiveLayout(schema: ILayoutSchema, data: any) {
    if (schema.datasource) {
      data = await this.loadData(schema.datasource);
    }

    const liveSchema = schema;
    const rowTemplate: any = liveSchema.$children;
    if (rowTemplate && data) {
      liveSchema.children = data.map((d: any, index: number) =>
        rowTemplate.map((s: any) => {
          const newSchema = _.cloneDeep(s);
          if (newSchema.datasource) {
            newSchema.datasource = newSchema.datasource.replace("$", index);
          }
          return newSchema;
        })
      );
    }

    // add a new children
    return liveSchema;
  }
}
