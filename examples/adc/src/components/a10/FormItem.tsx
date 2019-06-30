import React from "react";
import _ from "lodash";
import { Form, Input } from "antd";
// import components from '../';
import { UIEngineRegister } from "UIEngine";

const { Item } = Form;

export const FormItem = (props: any) => {
  let { children, type, errorInfo, ...rest } = props;
  let element: any = children;
  if (type) {
    if (type.indexOf(":") === -1) type = "antd:" + _.upperFirst(type);
    const componentMap: any = UIEngineRegister.componentsLibrary;
    const [packageName, component] = type.split(":");
    const InputComponent: any = componentMap[packageName]
      ? componentMap[packageName][component]
      : componentMap[component];
    if (InputComponent) {
      element = <InputComponent {...rest} />;
    } else {
      element = <Input {...rest} />;
    }
  }

  let error = {};
  if (!_.get(errorInfo, "status", true)) {
    error = {
      validateStatus: _.isString(errorInfo.status) ? errorInfo.status : "error",
      help: errorInfo.code
    };
  }

  return (
    <Item {...rest} {...error}>
      {element}
    </Item>
  );
};
