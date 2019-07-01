import { IUINode } from "../UINode";

export interface IUIEngineProps {
  layouts: Array<any>;
  [anyKey: string]: any;
}

export interface IUIEngineStates {
  nodes: Array<IUINode>;
  activeNodeID: string;
  [anyKey: string]: any;
}
