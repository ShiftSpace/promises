/*
  Promises version 0.6
  
  An implementation of promises for MooTools:
  http://en.wikipedia.org/wiki/Futures_and_promises
*/

Function.implement({
  asPromise: function() { return this.decorate(promise); }
});

/*
  Class: Promise
    You can create empty Promise instances, Promises from unsent Request instances
    or from an array of values containing promises.
    
    new Promise();
    new Promise(new Request({url:'bar.html'}));
    new Promise(["foo", new Promise(new Request({url:'bar.html'})), "baz"]);
    
    Please note that you should not initialize Promise with a Request which has already 
    been sent.
*/
var Promise = new Class({

  Implements: [Events, Options],
  name: "Promise",
  
  defaults: {
    lazy: false,
    reduce: null,
    bare: false,
    meta: null
  },
  
  initialize: function(value, options) {
    this.setOptions(this.defaults, options);
    this.__realized = false;
    this.__ops = [];
    if(this.options.meta) this.setMeta(this.options.meta);
    if(value && value.xhr) {
      this.initReq(value);
    } else if(value && $type(value) == "array") {
      Promise.watch(value, function(promises) {
        var values = promises.map(Promise.getValue);
        var result = (this.options.reduce && this.options.reduce.apply(null, values)) || values;
        this.setValue(result);
      }.bind(this));
    } else if(value && 
              !Promise.isPromise(value) && 
              $type(value) == "object" && 
              $H(value).getValues().some(Promise.isPromise)) {
      Promise.watch($H(value).getValues(), function(promises) {
        this.setValue($H(value).map(Promise.getValue).getClean());
      }.bind(this));
    } else if(Promise.isPromise(value)) {
      value.addEvent('realized', function() {
        this.setValue(value.value());
      }.bind(this))
    } else if(typeof value != 'undefined') {
      this.__plain = true;
      this.setValue(value, false);
    }
    return this;
  },
  
  setMeta: function(meta) { this.__meta = meta; },
  meta: function() { return this.__meta; },
  
  initReq: function(req) {
    this.__req = req;
    req.addEvent('onSuccess', function(responseText) {
      var json = (!req.options.bare) ? JSON.decode(responseText) : responseText;
      var v = json.data || json;
      this.setValue(this.applyOps(v));
    }.bind(this));
    req.addEvent('onFailure', function(responseText) {
      this.setValue(undefined);
      this.fireEvent('error', this);
    }.bind(this));
  },
  
  realize: function() {
    if(this.__req && !this.__realizing) {
      this.__realizing = true;
      if(Promise.debug) this.__req.options.async = false;
      this.__req.send();
    } else if(this.__plain) {
      this.setValue(this.value());
    }
    return this;
  },
  
  applyOps: function(value) {
    var aop = this.__ops.shift();
    while(aop) {
      value = aop(value);
      aop = this.__ops.shift();
    }
    return value;
  },
  
  /*
    Method: op
      You can modify the value of unrealized Promise with op. If the Promise
      is unrealized, the return value will be the Promise itself. If already
      realized, the return value will be value of the Promise after the operation
      has been applied.
  */
  op: function(fn) {
    if(!this.__realized) {
      this.__ops.push(fn);
    } else {
      this.setValue(fn(this.__value));
    }
    if(!this.__realized) return this;
    return this.value();
  },
  
  hasOps: function() { return this.__ops.length > 0; },
  
  setValue: function(value, notify) {
    if(value && value.xhr) {
      this.initReq(value);
    } else {
      this.__value = value;
      if(!this.__realized && notify !== false) {
        this.__realized = true;
        this.fireEvent('realized', this.__value);
      }
    }
  },
  
  value: function(applyOps) {
    if(this.hasOps() && applyOps !== false) this.__value = this.applyOps(this.__value);
    return this.__value;
  },
  
  isRealized: function() { return this.__realized; },
  isNotRealized: function() { return !this.__realized; },
  isLazy: function() { return this.options.lazy; },
  isNotLazy: function() { return !this.options.lazy; },

  get: function() {
    var args = $A(arguments);
    if(!this.isRealized()) return (new Promise(this, {lazy:this.options.lazy})).op(function(v) { return $get.apply(null, [v].extend(args)); });
    return $get.apply(null, [this.value()].extend(args));
  },
  
  fn: function(fn) {
    if(!this.isRealized()) return (new Promise(this, {lazy:this.options.lazy})).op(fn);
    return fn(this.value());
  }
});

var $P = $promise = function(v, options) { return new Promise(v, options); };
var $lazy = function(v, options) { return new Promise(v, $merge({lazy:true}, options)); };

Promise.debug = false;

Promise.isPromise = function(obj) {
  return (obj && obj.name == "Promise");
}

Promise.getValue = function(v) {
  while (Promise.isPromise(v) && v.isRealized()) v = v.value();
  return v;
}

/*
  Function: Promise.toValues
    Map an array of values to only non-Promise values or
    unrealized Promise values.
*/
Promise.toValues = function(ary) {
  while(ary.some(Promise.isPromise)) ary = ary.map(Promise.getValue);
  return ary;
}

/*
  Function: Promise.promiseOrValue
    If v is a Request object returns a promise, otherwise
    if v is Promise which has been realized returns the promises
    value. If it is not a promise, the value is simply returned.
*/
Promise.promiseOrValue = function(v) {
  if(v && v.xhr) return new Promise(v);
  if(Promise.isPromise(v) && v.isRealized()) return v.value();
  return v;
}

/*
  Function: Promise.watch
    Watch an array of values containing unrealized promises.
    This will not call the callback until there no unrealized
    promises left. This means if the value of a Promise is
    another Promise which is not realized, Promise.watch will simply
    Promise.watch the values again.
    
  Parametes:
    args - an array of values, can contain Promise instances realized or unrealized.
    cb - a function callback.
    errCb - a error callback.
*/
Promise.watch = function(args, cb, errCb) {
  var promises = args.filter(Promise.isPromise);
  var unrealized = promises.filter($msg("isNotRealized"));
  if(unrealized.length > 0) {
    var watching = new Group(unrealized);
    watching.addEvent('realized', function() {
      args = args.map(Promise.getValue);
      if(!Promise.allRealized(args)) {
        Promise.watch(args, cb, errCb);
      } else {
        cb(Promise.toValues(args));
      }
    });
    if(errCb) {
      unrealized.each(function(aPromise) {
        aPromise.addEvent('error', errCb.bind(null, [aPromise]));
      });
    }
    unrealized.filter($msg('isNotLazy')).each($msg('realize'));
  } else {
    cb(Promise.toValues(args))
  }
}

Promise.allRealized = function(vs) { return vs.filter(Promise.isPromise).every($msg("isRealized")); }

/*
  Decorator: promise
    The promise decorator. Takes a function and returns a new function that
    can handle Promises as arguments. If this new function recieves any Promises
    it will continue to block until it can convert all of it's arguments to 
    non-Promise values.
*/
function promise(fn) {
  return function decorator() {
    var args = $A(arguments);
    var promises = args.filter(Promise.isPromise);
    var unrealized = promises.filter($msg('isNotRealized'));
    if(unrealized.length > 0) {
      if(!Promise.debug) {
        var p = new Promise();
        Promise.watch(
          args, 
          function(values) {
            // hack so that this.parent(...) is meaningful even after an async call
            var temp = this._current;
            this._current = decorator._wrapper;
            p.setValue(fn.apply(this, values));
            this._current = temp;
          }.bind(this),
          function(errPromise) {
            var err = new Error("Failed to realize promise from " + errPromise.__req.options.url);
            err.promise = errPromise;
            err.source = fn.toString();
            err.sourceArgs = args;
            throw err;
          }.bind(this));
        return p;
      } else {
        var temp = this._current;
        unrealized.each($msg('realize'));
        var values = args.map(Promise.getValue);
        this._current = decorator._wrapper;
        result = fn.apply(this, values);
        this._current = temp;
        return result;
      }
    } else {
      var porv = Promise.promiseOrValue(fn.apply(this, args.map(Promise.getValue)));
      return porv;
    }
  }
}

var $if = function(test, trueExpr, falseExpr) {
  if(test) {
    if($type(trueExpr) == "function") return trueExpr();
    return trueExpr;
  } else if(falseExpr) {
    if($type(falseExpr) == "function") return falseExpr();
    return falseExpr;
  }
}.asPromise();