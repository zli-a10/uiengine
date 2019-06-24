import { IUINode } from "../UINode";

export interface IState {}

export type StatePluginFunc = (
  this: IStateNode,
  stateNode: IStateNode
) => IState;

export interface IStateNode {
  errorInfo: IErrorInfo;
  state: IState;
  uiNode: IUINode;
  plugins: object;
  pluginManager: IPluginManager;
  getUINode(): IUINode;
  getState(key?: string): IState;
  renewStates();
  setState(key: string, value: any): IState;
  getPluginManager(): IPluginManager;
}
