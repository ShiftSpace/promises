Array.implement({
  first: function() {
    return this[0];
  },
  
  rest: function() {
    return this.slice(1, this.length);
  },
  
  drop: function(n) {
    return this.slice(n, this.length);
  },
  
  isEmpty: function() {
    return this.length == 0;
  },
  
  isEqual: function(ary) {
    if(this.length != ary.length) return false;
    for(var i = 0; i < this.length; i++)
    {
      if(this[i] != ary[i]) return false;
    }
    return true;
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
      throw new Error("You can only create empty promises or promises from Request objects.");
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
  return obj.name == "Promise";
}

// returns a value if not a promise
// otherwise unwraps promises until we get to an unrealized one
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
  if(v.xhr)
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
    // convert immediately
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
    
    if(promises.length > 0)
    {
      var p = new Promise();
      
      Promise.watch(args, function(realized) {
        p.setValue(fn.apply(this, realized));
      }.bind(this));

      return p;
    }
    else
    {
      var porv = Promise.promiseOrValue(fn.apply(this, args));
      return porv;
    }
  }
}