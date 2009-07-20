Array.implement({
  drop: function(n) 
  {
    return this.slice(n, this.length);
  }
});


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
  
  defaults:
  {
    lazy: true,
    reduce: null
  },
  
  initialize: function(value, options)
  {
    this.setOptions(this.defaults, options);
    
    this.__realized = false;
    this.__ops = [];
    
    if(value && value.xhr)
    {
      this.initReq(value);
    }
    else if(value && $type(value) == "array")
    {
      Promise.watch(value, function(promises) {
        var values = promises.map(Promise.getValue);
        var result = (this.options.reduce && this.options.reduce.apply(null, values)) || values;
        this.setValue(result);
      }.bind(this));
    }
    else if(value)
    {
      throw new Error("You can only create empty promises or promises from Request objects.");
    }
  },

  
  initReq: function(req)
  {
    this.__req = req;
    req.addEvent('onComplete', function(responseText) {
      this.setValue(this.applyOps(JSON.decode(responseText).data));
    }.bind(this));
    if(!this.options.lazy) req.send();
  },
  
  
  realize: function()
  {
    if(this.__req) this.__req.send();
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
    if(!this.__realized) return this;
    return this.value();
  },
  
  
  hasOps: function()
  {
    return this.__ops.length > 0;
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
     if(this.hasOps()) this.__value = this.applyOps(this.__value);
     return this.__value;
  },
  
  
  isRealized: function()
  {
    return this.__realized;
  },
  
  
  isNotRealized: function()
  {
    return !this.__realized;
  }
});


Promise.isPromise = function(obj)
{
  return (obj && obj.name == "Promise");
}


Promise.getValue = function(v)
{
  while (Promise.isPromise(v) && v.isRealized())
  {
    v = v.value();
  }
  return v;
}


Promise.toValues = function(ary)
{
  while(ary.some(Promise.isPromise))
  {
    ary = ary.map(Promise.getValue);
  }
  return ary;
}


Promise.promiseOrValue = function(v)
{
  if(v && v.xhr)
  {
    return new Promise(v);
  }
  return v;
}


Promise.watch = function(args, cb)
{
  var promises = args.filter(Promise.isPromise);
  var unrealized = promises.filter($msg("isNotRealized"));
  
  if(unrealized.length > 0)
  {
    var watching = new Group(unrealized);
    unrealized.each($msg('realize'));
  
    watching.addEvent('realized', function() {
      args = args.map(Promise.getValue);
      if(!Promise.allRealized(args))
      {
        Promise.watch(args, cb);
      }
      else
      {
        cb(Promise.toValues(args));
      }
    });
  }
  else
  {
    cb(Promise.toValues(args))
  }
}


Promise.allRealized = function(vs)
{
  return vs.filter(Promise.isPromise).every($msg("isRealized"));
}


function promise(fn) 
{
  return function decorator() {
    var args = $A(arguments);

    var promises = args.filter(Promise.isPromise);
    var unrealized = promises.filter($msg('isNotRealized'));
    
    if(unrealized.length > 0)
    {
      var p = new Promise();
      
      Promise.watch(args, function(realized) {
        p.setValue(fn.apply(this, realized));
      }.bind(this));

      return p;
    }
    else
    {
      var porv = Promise.promiseOrValue(fn.apply(this, args.map(Promise.getValue)));
      return porv;
    }
  }
}