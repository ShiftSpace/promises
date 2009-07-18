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
  
  
  initialize: function(value, options)
  {
    this.__realized = false;
    this.__ops = [];
    
    if(value && !value.xhr)
    {
      throw new Error("You can only create empty promises or promises from Request.JSON objects.");
    }
    else if(value && value.xhr)
    {
      this.initReq(value);
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


function isPromise(obj)
{
  return obj.name == "Promise";
}


function value(v)
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

    var promises = args.filter(function(arg) {
      return isPromise(arg);
    });
    
    if(promises.length > 0)
    {
      var watching = new Group(promises);
      var p = new Promise();

      watching.addEvent("realized", function() {
        args = args.map(value);
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