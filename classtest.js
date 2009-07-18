window.addEvent('domready', ctinit);


var MyClass = new Class({
  a: function() 
  {
    return new Request({
      method: 'get',
      url: 'a.json'
    });    
  }.decorate(promise),
  
  b: function()
  {
    return new Request({
      method: 'get',
      url: 'b.json'
    });    
  }.decorate(promise),
  
  add: function()
  {
    return new Promise([this.a(), this.b()], function(a, b) {
      return a + b;
    });
  }.decorate(promise)
});


var ctshow = function(value)
{
  console.log("show: " + value);
}.decorate(promise)


var v;
function ctinit()
{
  var instance = new MyClass();
  ctshow(instance.add());
}