import _ from "lodash";
import {
  IPluginManager,
  IPlugins,
  IErrorInfo,
  IPlugin,
  IPluginExecutionConfig
} from "../../typings";

export default class PluginManager implements IPluginManager {
  static plugins: IPlugins = {};
  private caller: any;
  result: object = {};
  errorInfo: IErrorInfo = {};

  constructor(caller: any, plugins?: IPlugins) {
    if (plugins) {
      PluginManager.loadPlugins(plugins);
    }
    this.caller = caller;
  }

  getPlugins(type?: string, name?: string) {
    return PluginManager.getPlugins(type, name);
  }

  static getPlugins(type?: string, name?: string) {
    if (name && type) {
      return _.get(PluginManager.plugins, `${type}.${name}`);
    } else if (type) {
      return _.get(PluginManager.plugins, type);
    } else {
      return PluginManager.plugins;
    }
  }

  unloadPlugins(type?: string, name?: string) {
    return PluginManager.unloadPlugins(type, name);
  }

  static unloadPlugins(type?: string, name?: string) {
    if (name && type) {
      _.unset(PluginManager.plugins, `${type}.${name}`);
    } else if (type) {
      _.unset(PluginManager.plugins, type);
    } else {
      PluginManager.plugins = {};
    }
  }

  loadPlugins(newPlugins: IPlugins): IPlugins {
    return PluginManager.loadPlugins(newPlugins);
  }

  static loadPlugins(newPlugins: IPlugins): IPlugins {
    _.forIn(newPlugins, (p: IPlugin, key: string) => {
      let { type, weight } = p;
      if (type) {
        const name = p.name || key;
        const originPlugin = _.get(PluginManager.plugins, `${type}.${name}`);
        if (!originPlugin || (originPlugin && weight > originPlugin.weight)) {
          _.set(PluginManager.plugins, `${type}.${name}`, p);
        }
      }
    });
    return PluginManager.plugins;
  }

  async executePlugins(type: string, config?: IPluginExecutionConfig) {
    let result = this.executeSyncPlugins(type, config);
    if (_.get(config, "returnLastValue")) {
      return await result;
    } else {
      for (let name in result) {
        result[name] = await result[name];
      }
      return result;
    }
  }

  executeSyncPlugins(type: string, config?: IPluginExecutionConfig) {
    const plugins: IPlugins = _.get(PluginManager.plugins, type);
    let result;
    // sort by weight asc
    let sortedPlugins = _.values(plugins);
    sortedPlugins = _.sortBy(sortedPlugins, ["weight"]);
    // console.log(sortedPlugins);

    sortedPlugins.forEach((p: IPlugin, k: number) => {
      const name = p.name;
      if (!p.callback) return;

      try {
        result = p.callback.call(this.caller, this.caller);
        _.set(this.result, `${type}.${name}`, result);

        // break conditions
        if (_.get(config, "stopWhenEmpty") && _.isEmpty(result)) return;
        if (_.isEqual(_.get(config, "executeOnlyPluginName"), name)) return;
      } catch (e) {
        console.error(`plugin [${k}] executed failed:`, e);
        this.setErrorInfo(p.type, name, e.message);
      }
    });

    if (_.get(config, "returnLastValue")) {
      return result;
    }
    return _.get(this.result, type, {});
  }

  setErrorInfo(type: string, name: string, value: any): IErrorInfo {
    _.set(this.errorInfo, `${type}.${name}`, value);
    return this.errorInfo;
  }
}