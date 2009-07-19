Function.implement({
  decorate: function()
  {
    var decorators = $A(arguments);
    var resultFn = this;
    decorator = decorators.pop();
    
    while(decorator)
    {
      resultFn = decorator(resultFn);
      decorator = decorators.pop();
    }
    
    return resultFn;
  },
  
  rewind: function(bind, args)
  {
    return this._wrapper.bind(bind, args);
  }
});


function $msg(methodName) 
{
  var rest = $A(arguments).drop(1);
  return function(obj) {
    return obj[methodName].apply(obj, rest);
  };
}


var Promise = new Class({

  Implements: [Events, Options],
  name: "Promise",
  
  
  initialize: function(value, reduce)
  {
    this.__realized = false;
    this.__ops = [];
    
    if(value && value.xhr)
    {
      this.initReq(value);
    }
    else if(value && $type(value) == "array" && reduce && $type(reduce) == "function")
    {
      var promises = value.filter(Promise.isPromise);
      var watch = new Group(promises);
      watch.addEvent("realized", function() {
        this.setValue(reduce.apply(null, value.map(Promise.getValue)));
      }.bind(this));
    }
    else if(value)
    {
      throw new Error("You can only create empty promises or promises from Request.JSON objects.");
    }
  },

  
  initReq: function(req)
  {
    this.__req = req;
    req.addEvent('onComplete', function(responseText) {
      this.setValue(this.applyOps(JSON.decode(responseText).data));
    }.bind(this));
    req.send();
  },
  
  
  applyOps: function(value)
  {
    var aop = this.__ops.shift();
    while(aop) {
      value = aop(value);
      aop = this.__ops.shift();
    }
    return value;
  },
  
  
  op: function(fn)
  {
    if(!this.__realized)
    {
      this.__ops.push(fn);
    }
    else
    {
      this.setValue(fn(this.__value));
    }
  },
  
  
  setValue: function(value)
  {
    if(!value) return;
    
    if(value.xhr)
    {
      this.initReq(value);
    }
    else
    {
      this.__value = value
      
      if(!this.__realized)
      {
        this.__realized = true;
        this.fireEvent('realized', this.__value);
      }
    }
  },
  
  
  value: function()
  {
    return this.__value;
  },
  
  
  isRealized: function()
  {
    return this.__isRealized;
  }
});


Promise.isPromise = function(obj)
{
  return obj.name == "Promise";
}


Promise.getValue = function(v)
{
  if(Promise.isPromise(v)) return v.value();
  return v;
}


Promise.promiseOrValue = function(v)
{
  if(v.xhr)
  {
    return new Promise(v);
  }
  return v;
}


Promise.watch = function(vs, cb)
{
  var watching = new Groups(vs);
  var p = new Promise();
}


Promise.allRealized = function(vs)
{
  return vs.filter(isPromise).map($msg("isRealized"));
}


function promise(fn) 
{
  return function decorator() {
    var args = $A(arguments);

    var promises = args.filter(Promise.isPromise);
    
    if(promises.length > 0)
    {
      var watching = new Group(promises);
      var p = new Promise();

      
      
      watching.addEvent("realized", function() {
        args = args.map(Promise.getValue);
        p.setValue(fn.apply(this, args));
      }.bind(this));

      return p;
    }
    else
    {
      var porv = Promise.promiseOrValue(fn.apply(this, args));
      if(porv.name == "Promise") console.log("return promise " + fn.name);
      return porv;
    }
  }
}