import _ from "lodash";
import { IMessager } from "../../typings";

export default class Messager implements IMessager {
  static instance: IMessager;
  static getInstance = () => {
    if (!Messager.instance) {
      Messager.instance = new Messager();
    }
    return Messager.instance as Messager;
  };

  objectStateFuncMap = {
    // [id]: setState
  };

  sendMessage(schemaID: string, info: any) {
    const setState = this.objectStateFuncMap[schemaID];
    if (_.isFunction(setState)) {
      return setState(info);
    } else {
      return false;
    }
  }

  setStateFunc(schemaID: string, setState: any) {
    if (_.isFunction(setState)) {
      this.objectStateFuncMap[schemaID] = setState;
    }
  }

  removeStateFunc(schemaID: string) {
    _.unset(this.objectStateFuncMap, schemaID);
  }
}