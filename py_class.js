// JS: Python-styled classes: Binds selfs and use python naming.

// Creating a class:
/*
const Human = py_class("Human", {
  initials: {"M": "Mr", "F": "Mrs"}, // This is static
  
  __init__(self, gender, name) {
    self.name = name;
  }, // Commas required after each definition
  
  say_name(self) {
    console.log(`Hi, I'm ${self.initials[self.gender]} ${self.name}`); // Binds self
  },
  
  s$greet() { // s$: @staticmethod, c$: @classmethod
    console.log("Greetings!");
  }
});
*/

// Inheritance:
/*
const Angel = py_class("Angel", Human, {
});

Angel.$super(); // returns contents of merged parent classes.
*/

export function py_class(name, bases_or_object, object = undefined) {
  const base_chain = (
    (object === undefined) ? [] :
    (typeof(bases_or_object) === "function") ? [bases_or_object, ] :
    (Array.isArray(bases_or_object)) ? bases_or_object.reverse() :
    (() => {throw Error("py_class: Invalid inherited object", bases_or_object);})()
    );
    
  const base_chain_objects = base_chain.map((py_class_f) => py_class_f.__base__);
  const class_base_object = (object === undefined) ? bases_or_object : object;
  
  const class_ref_object = Object.assign({}, ...base_chain_objects, class_base_object);
  class_ref_object.__name__ = name;
  class_ref_object.__bases__ = base_chain;
  class_ref_object.__base__ = class_base_object;
  class_ref_object.__ref__ = class_ref_object;

  let construct = undefined;
  
  function bind_self_and_return(self, name, method) {
    const name_parts = name.split("$");
    let [method_flag, method_name] = [null, name];
    if (name_parts.length > 1) {[method_flag, method_name] = [name_parts[0], name_parts.slice(1).join("$")]};
    
    const available_flags = ["c", "s", "prop", "set"];
    if (!!method_flag && !available_flags.includes(method_flag)) {
      [method_flag, method_name] = [null, `${method_flag}$${method_name}`];
    }
    
    if (typeof(method) !== "function") { // Static values
      return [true, method_name, method];
    }
    
    function classmethod(method) {
      return [true, method_name, (...args) => method(construct, ...args)];
    }
    
    function staticmethod(method) {
      return [true, method_name, method];
    }
    
    function instancemethod(method) {
      return [false, method_name, (...args) => method(self, ...args)];
    }

    function instanceproperty(method) {
      if (typeof(self) === "object" && self !== null) {
        Object.defineProperty(self, method_name, {get: () => method(self), configurable: true});
      }
      return [false, `__get_${method_name}`, method];
    }

    function instancesetter(method) {
      if (typeof(self) === "object" && self !== null) {
        Object.defineProperty(self, method_name, {set: (value) => method(self, value), configurable: true});
      }
      return [false, `__set_${method_name}`, method];
    }

    const handlers = {
      "c": classmethod, "s": staticmethod, 
      "prop": instanceproperty, "set": instancesetter,
      null: instancemethod};
    
    return handlers[method_flag](method);
  }

  construct = function __construct(...args) {
    const self = {};
    
    for (let [ref_name, ref_method] of Object.entries(class_ref_object)) {
      const [is_static, binded_name, binded_method] = bind_self_and_return(self, ref_name, ref_method);
      self[binded_name] = binded_method;
    }
    
    self.$super = function() {
      let instance_super = {};
      
      for (let base_chain_object of base_chain_objects) {
        for (let [ref_name, ref_method] of Object.entries(base_chain_object)) {
          const [is_static, binded_name, binded_method] = bind_self_and_return(self, ref_name, ref_method);
          instance_super[binded_name] = binded_method;
        }
      }
      
      return instance_super;
    }

    self.__dict__ = () => self;

    if (typeof(self.__init__) === "function") {
      const override_self = self.__init__(...args);
      if (override_self !== undefined) return override_self;
    }

    return self;
  }
  
  for (let [ref_name, ref_method] of Object.entries(class_ref_object)) {
    const [is_static, static_name, static_method] = bind_self_and_return(undefined, ref_name, ref_method);
    if (is_static) {construct[static_name] = static_method;}
  }

  construct.$super = function() {
    let static_super = {};
    
    for (let base_chain_object of base_chain_objects) {
      for (let [ref_name, ref_method] of Object.entries(base_chain_object)) {
        const [is_static, static_name, static_method] = bind_self_and_return(undefined, ref_name, ref_method);
        if (is_static) {static_super[static_name] = static_method;}
      }
    }
    
    return static_super;
  }

  construct.__class__ = construct;
  construct.__dict__ = () => Object.assign({}, construct);

  return construct;
}
