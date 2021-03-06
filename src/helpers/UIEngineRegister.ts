import _ from 'lodash'

import PluginManager from './PluginManager'
import HandlerManager from './HandlerManager'
import {
  IPlugin,
  IPluginMap,
  IPluginManager,
  IHandlerConfig,
  IHandlerMap,
  IHandlerManager,
} from '../../typings'

export class UIEngineRegister {
  static componentsLibrary = {}
  static publicMap = {}

  static registerPlugins(plugins: IPlugin[] | IPluginMap, manager?: IPluginManager) {
    if (_.isNil(manager)) {
      manager = PluginManager.getInstance()
    }
    if (_.isArray(plugins)) {
      manager.loadPlugins(plugins)
    } else {
      manager.loadPlugins(Object.values(plugins))
    }
  }

  static registerHandlers(handlers: IHandlerConfig[] | IHandlerMap, manager?: IHandlerManager) {
    if (_.isNil(manager)) {
      manager = HandlerManager.getInstance()
    }
    if (_.isArray(handlers)) {
      manager.loadHandlers(handlers)
    } else {
      manager.loadHandlers(Object.values(handlers))
    }
  }

  static registerComponents(components: any, libraryName?: string) {
    if (libraryName) {
      UIEngineRegister.componentsLibrary[libraryName] = components
    } else {
      UIEngineRegister.componentsLibrary = components
    }
  }

  static registerMap(type: string, config: { [name: string]: any } | Array<{ name: string }>) {
    if (_.isString(type) && type) {
      let map = UIEngineRegister.publicMap[type]
      if (_.isNil(map)) {
        map = {}
        UIEngineRegister.publicMap[type] = map
      }

      if (_.isArray(config)) {
        config.forEach((item) => {
          if (_.isObject(item)) {
            const { name } = item
            if (_.isString(name) && name) {
              map[name] = item
            }
          }
        })
      } else if (_.isObject(config)) {
        _.assign(map, config)
      }
    }
  }
  static searchMap(type: string, name?: string) {
    if (_.isString(type) && type) {
      const map = UIEngineRegister.publicMap[type]

      if (!_.isNil(map)) {
        if (_.isString(name) && name) {
          return _.get(map, name)
        }

        return map
      }
    }

    return undefined
  }
}
