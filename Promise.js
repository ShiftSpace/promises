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


var Promise = new Class({

  Implements: [Events, Options],
  name: "Promise",
  
  
  initialize: function(value, fn)
  {
    this.__realized = false;
    this.__ops = [];
    
    if(value && value.xhr)
    {
      this.initReq(value);
    }
    else if(value && $type(value) == "array")
    {
      var promises = value.filter(isPromise);
      var watch = new Group(promises);
      watch.addEvent("realized", function() {
        this.setValue(fn.apply(null, value.map(getValue)));
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
  }
});


var Watcher = new Class({
  initialize: function()
  {
    
  }
});


function isPromise(obj)
{
  return obj.name == "Promise";
}


function getValue(v)
{
  if(isPromise(v)) return v.value();
  return v;
}


function promiseOrValue(v)
{
  if(v.xhr)
  {
    return new Promise(v);
  }
  return v;
}


function promise(fn) 
{
  return function decorator() {
    var args = $A(arguments);

    var promises = args.filter(isPromise);
    
    if(promises.length > 0)
    {
      var watching = new Group(promises);
      var p = new Promise();

      watching.addEvent("realized", function() {
        args = args.map(getValue);
        p.setValue(fn.apply(this, args));
      }.bind(this));

      return p;
    }
    else
    {
      return promiseOrValue(fn.apply(this, args));
    }
  }
}