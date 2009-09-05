function $identity(v) { return v; }

function $callable(v) { return v && $type(v) == 'function'; }

function $not(fn) {
  return function() {
    return !fn.apply(this, $A(arguments));
  }
}

function $range(a, b) {
  var start = (b && a) || 0, end = b || a;
  return $repeat(end-start, function() { return start++; });
}

function $isnull(v) { return v === null; };

function $notnull(v) { return v !== null; };

function $iterate(n, fn) {
  var result = [];
  (n).times(function() {
    result.push(fn());
  });
  return result;
};

function $repeat(n, v) {
  return $iterate(n, $lambda(v));
};

function $arglist(fn) {
  return fn._arglist || fn.toString().match(/function \S*\((.*?)\)/)[1].split(',');
};

function $arity() {
  var fns = $A(arguments);
  var dispatch = [];
  fns.each(function(fn) {
    var arglist = $arglist(fn);
    dispatch[arglist.length] = fn;
  });
  return function () {
    var args = $A(arguments).filter($notnull);
    return dispatch[args.length].apply(this, args);
  }
};

function $reduce(fn, ary) {
  ary = $A(ary);
  var result = ary.first();
  while(ary.length != 0) {
    var rest = ary.rest();
    result = fn(result, rest);
    ary = rest;
  }
  return result;
};

function $get(first, prop) {
  var args = $A(arguments), rest = args.rest(2), next;
  if(rest.length == 0) return first[prop];
  if(['object', 'array'].contains($type(first))) next = first[prop];
  if($type(next) == 'function') next = first[prop]();
  return (next == null) ? null : $get.apply(null, [next].concat(rest));
};

function $acc() {
  var args = $A(arguments);
  return function(obj) {
    return $get.apply(null, [obj].combine(args));
  };
};

Function.implement({
  decorate: function() {
    var decorators = $A(arguments), orig = resultFn = this, decorator;
    while(decorator = decorators.pop()) resultFn = decorator(resultFn);
    resultFn._arglist = $arglist(orig);
    resultFn._decorated = orig;
    return resultFn;
  },

  comp: function() {
    var fns = $A(arguments), self = this;
    return function() {
      var temp = $A(fns);
      var args = $A(arguments), result = (self && $type(self) == 'function') ? self.apply(this, args) : null, fn;
      while(fn = temp.shift()) result = fn.apply(null, (result && [result]) || args);
      return result;
    }
  },
  
  partial: function(bind, args) {
    var self = this;
    args = $splat(args);
    return function() {
      return self.apply(bind, args.concat($A(arguments)));
    };
  }
});
var $comp = Function.comp;

function memoize(fn) {
  var table = {};
  return function memoized() {
    var args = $A(arguments);
    var enc = JSON.encode(args);
    if(!table[enc]) {
      var result = fn.apply(this, args);
      table[enc] = result;
      return result;
    } else {
      return table[enc];
    }
  };
}

// We need a backreference to wrapper to support decorator usage from within classes - David
Class.extend({
  wrap: function(self, key, method) {
    if (method._origin) method = method._origin;
    var wrapper = function() {
      if (method._protected && this._current == null) throw new Error('The method "' + key + '" cannot be called.');
      var caller = this.caller, current = this._current;
      this.caller = current; this._current = arguments.callee;
      var result = method.apply(this, arguments);
      this._current = current; this.caller = caller;
      return result;
    }.extend({_owner: self, _origin: method, _name: key});
    method._wrapper = wrapper;
    return wrapper;
  }
});

Array.implement({
  first: function() { return this[0]; },
  rest: function(n) { return this.slice(n || 1, this.length); },
  drop: function(n) { return this.slice(0, this.length-n); },
  tail: function(n) { return this.slice(n, this.length); },
  head: function(n) { return this.slice(0, n) },
  partition: function(n) {
    if(this.length % n != 0) throw Error("The length of this array is not a multiple of " + n);
    var result = [];
    var ary = this;
    while(ary.length > 0) {
      var sub = ary.head(n);
      result.push(sub);
      ary = ary.tail(n);
    }
    return result;
  }
});

Hash.implement({
  asFn: function() {
    var self = this;
    return function(k) {
      return self[k];
    };
  }
})

function $msg(methodName) {
  var rest = $A(arguments).rest();
  return function(obj) {
    var method = obj[methodName];
    if(method && $type(method) == 'function') return method.apply(obj, rest);
  };
}

// =====================
// = Common Operations =
// =====================

var add = function(a, b) { return a + b; }.asPromise();
var sum = $arity(
  function(a) { return a; }.asPromise(),
  function(a, b) { return add(a, (($type(b) == 'array') ? b.first() || 0 : b)); }.asPromise()
);