var DelayedAsset = new Class({
  Implements: Events,
  name: "DelayedAsset",
  
  initialize: function(type, source, properties) {
    this.type = type;
    this.source = source;
    this.properties = properties || {};
  },

  load: function() {
    switch(this.type) {
      case 'javascript':
        this.asset = new Asset.javascript(this.source, $merge(this.properties, {
          onload: function() {
            if($callable(this.properties.onload)) this.properties.onload(this.asset);
            this.fireEvent('onload', this.asset);
          }.bind(this)
        }));
        break;
      case 'css':
        this.asset = new Asset.css(this.source, $merge(this.properties));
        break;
      case 'image':
        this.asset = new Asset.image(this.source, $merge(this.properties, {
          onload: function() {
            if($callable(this.properties.onload)) this.properties.onload(this.asset);
            this.fireEvent('onload', this.asset);
          }.bind(this),
          onabort: function() {
            if($callable(this.properties.onabort)) this.properties.onabort(this.asset);
            this.fireEvent('onabort', this.asset);
          }.bind(this),
          onerror: function() {
            if($callable(this.properties.onerror)) this.properties.onerror(this.asset);
            this.fireEvent('onerror', this.asset);
          }.bind(this)
        }));
        break;
    }
  }
});
