import _ from 'lodash'

import { NodeController } from '../../../../data-layer'
import { replaceParam } from '../../../../helpers/utils'

import {
  IDataSource,
  IPlugin,
  IPluginExecution,
  IPluginParam,
} from '../../../../../typings'

/**
 * parse the endpoint by working mode
 * @directParam
 */
const execution: IPluginExecution = async (directParam: IPluginParam) => {
  const RP: any = _.get(directParam, 'RP')

  if (_.isObject(RP)) {
    const {
      layoutKey,
      dataSource,
      sendMethod,
      endpoint,
      requestPayload,
      operateMode,
    } = RP as any

    let urlParamMap = _.isObject(requestPayload) ? _.cloneDeep(requestPayload) : {}
    let queryParamMap = {}

    if (_.isString(layoutKey) && layoutKey) {
      const controller = NodeController.getInstance()
      const wMode = controller.getWorkingMode(layoutKey)

      if (_.isObject(wMode)) {
        const { mode, options, operationModes } = wMode
        if (_.isObject(options)) {
          const { urlParam, queryParam } = options
          if (_.isObject(urlParam) && !_.isEmpty(urlParam)) {
            _.assign(urlParamMap, urlParam)
          }
          if (_.isObject(queryParam) && !_.isEmpty(queryParam)) {
            _.assign(queryParamMap, queryParam.common, _.get(queryParam, sendMethod))
          }
        }

        if (mode === 'customize') {
          if (_.isArray(operationModes)) {
            operationModes.forEach((config) => {

              if (_.isObject(config)) {
                const { source: srcString, options: srcOptions } = config
                if (srcString === dataSource.source && _.isObject(srcOptions)) {
                  const { urlParam, queryParam } = srcOptions
                  if (_.isObject(urlParam) && !_.isEmpty(urlParam)) {
                    _.assign(urlParamMap, urlParam)
                  }
                  if (_.isObject(queryParam) && !_.isEmpty(queryParam)) {
                    _.assign(queryParamMap, queryParam.common, _.get(queryParam, sendMethod))
                  }
                }
              }

            })
          } else if (_.isObject(operationModes)) {
            const { source: srcString, options: srcOptions } = operationModes
            if (srcString === dataSource.source && _.isObject(srcOptions)) {
              const { urlParam, queryParam } = srcOptions
              if (_.isObject(urlParam) && !_.isEmpty(urlParam)) {
                _.assign(urlParamMap, urlParam)
              }
              if (_.isObject(queryParam) && !_.isEmpty(queryParam)) {
                _.assign(queryParamMap, queryParam.common, _.get(queryParam, sendMethod))
              }
            }
          }
        }

      }
    }

    let url = replaceParam(endpoint, urlParamMap, undefined)
    if (sendMethod === 'get') {
      const urlPath = url.split('/')
      const lastPath = urlPath.pop()
      if (_.isString(lastPath) && lastPath.match(/\{.*\}/)) {
        url = urlPath.join('/')
      }
    } else if (operateMode === 'create') {
      const urlPath = endpoint.split('/')
      const lastPath = urlPath.pop()
      if (_.isString(lastPath) && lastPath.match(/\{.*\}/)) {
        url = replaceParam(urlPath.join('/'), urlParamMap, undefined)
      }
    }
    if (url !== endpoint) {
      _.set(RP, 'endpoint', url)
    }

    if (!_.isEmpty(queryParamMap)) {
      _.set(RP, ['requestConfig', 'params'], queryParamMap)
    }
  }

  return true
}

export const endpointParser: IPlugin = {
  name: 'endpoint-parser',
  categories: ['data.request.before'],
  paramKeys: ['RP'],
  execution,
  priority: 0,
}
