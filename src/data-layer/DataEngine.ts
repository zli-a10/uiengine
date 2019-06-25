import _ from "lodash";

import {
  IDataEngine,
  IPluginManager,
  IRequest,
  IDataMapper,
  IPluginExecutionConfig
} from "../../typings";
import { PluginManager, Cache, DataMapper } from ".";

export default class UIEngine implements IDataEngine {
  private request: IRequest;
  errorInfo?: any;
  source: string;
  schemaPath: string;
  mapper: IDataMapper;
  data?: any;
  pluginManager: IPluginManager = new PluginManager(this);

  /**
   *
   * @param source a.b.c
   * @param request IRequest
   * @param loadDefaultPlugins whether load default plugins
   */
  constructor(
    source: string,
    request: IRequest,
    loadDefaultPlugins: boolean = true
  ) {
    this.request = request;
    this.source = source;
    if (loadDefaultPlugins) {
      this.pluginManager.loadPlugins({});
    }

    this.schemaPath = this.parseSchemaPath(source);
    this.mapper = new DataMapper(this.schemaPath, request);
  }

  parseSchemaPath(source: string) {
    const splitter = source.indexOf(":") > -1 ? ":" : ".";
    let [schemaPath] = source.split(splitter);
    return `${schemaPath}.json`;
  }

  async loadSchema(source?: string) {
    return await this.mapper.loadSchema(source);
  }

  async sendRequest(
    source?: string,
    data?: any,
    method: string = "get",
    cache: boolean = false
  ) {
    // clear initial data;
    this.data = {};
    this.errorInfo = null;
    if (!this.request[method] || !_.isFunction(this.request[method])) {
      this.errorInfo = {
        status: 1001,
        code: `Method ${method} did not defined on Request`
      };
      return false;
    }

    let schemaPath = "";
    if (source) {
      schemaPath = this.parseSchemaPath(source);
      this.source = schemaPath;
    } else {
      schemaPath = this.schemaPath;
    }

    let result = {};
    if (schemaPath) {
      const schema = await this.loadSchema(schemaPath);
      if (schema === null) {
        this.errorInfo = {
          status: 2001,
          code: `Schema for ${schemaPath} not found`
        };
        return false;
      }

      const endpoint = this.mapper.getDataEntryPoint(method);

      if (!endpoint) {
        this.errorInfo = {
          status: 1000,
          code: "URL not match"
        };
        return false;
      }

      try {
        let response: any;
        if (cache) response = Cache.getData(endpoint);

        // could stop the commit
        const exeConfig: IPluginExecutionConfig = {
          stopWhenEmpty: true,
          returnLastValue: true
        };
        const couldCommit = await this.pluginManager.executePlugins(
          "data.request.before",
          exeConfig
        );
        if (couldCommit === false) {
          this.errorInfo = {
            status: 1001,
            code: "Plugins blocked the commit"
          };
          return false;
        }

        // handle response
        if (!response) {
          response = await this.request[method](endpoint, data);
          if (response.data) {
            if (cache) Cache.setData(endpoint, response.data);
            response = response.data;
          }
        }
        result = response;
      } catch (e) {
        // console.log(e.message);
        this.errorInfo = {
          code: e.message
        };
      }
    }

    this.data = result;

    // could modify the response
    await this.pluginManager.executePlugins("data.request.after");
    return result;
  }

  async loadData(source?: string, params?: any) {
    return await this.sendRequest(source, params, "get", true);
  }

  async updateData(source?: string, data?: any) {
    return await this.sendRequest(source, data, "post");
  }

  async replaceData(source?: string, data?: any) {
    return await this.sendRequest(source, data, "put");
  }

  async deleteData(source?: string, data?: any) {
    return await this.sendRequest(source, data, "put");
  }
}
