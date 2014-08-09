App = Ember.Application.create();

App.Router.map(function() {
  // put your routes here
});

App.Alert = DS.Model.extend({
  alert_id: DS.attr('number'),
  area_name: DS.attr('string'),
  time:  DS.attr('date'),
  area_lat: DS.attr('number'),
  area_long: DS.attr('number'),

  expireTime: 600,
  visited: false,
});

App.IndexRoute = Ember.Route.extend({
    addAlerts: function (response) {
        var store = this.store;

        response.forEach(function (item) {
            var alert = store.createRecord('alert', item);

            setTimeout(function expiredAlert() {
                alert.destroyRecord();
            }, alert.get("expireTime") * 1000);
        })
    },

   model: function() {
        /* Initialize data */
        $.getJSON('http://tzeva-adom.com/alerts.php?fmt=jsonp&source=pikud&limit=5&callback=?').then(this.addAlerts.bind(this));

        var alerts = new Alerts("http://tzeva-adom.com:8080/redalert");
        alerts.callback(this.addAlerts.bind(this));
        alerts.poll();

        console.log();

        var original_background = $("body").css("background-image");
        var opacity = (1 + this.store.all("alert").length) / 10; 
        if (opacity > 1.0)
            opacity = 1.0; /* MAX */
        $("body").css("background-image", "linear-gradient(rgba(255, 0, 0, " + opacity + "),  rgba(255, 0, 0, " + opacity + "))," + original_background);

        return this.store.all("alert");
    },
});

App.LiveMapView = Ember.View.extend({
    classNames: ['live-map'], 
    templateName: 'live-map',

    // Ember is awesome.
    didInsertElement: function()
    {
        /* Initialize map */
        var map = new google.maps.Map(this.$().get(0), {
                zoom: 10,
                center: new google.maps.LatLng(31.4, 34.5),
                mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        this.set("map", map); /* Useful for inserting circles */
    },

    contentDidChange: function() {
        var map = this.get("map");

        this.get('controller.content').forEach(function alertCircle(alert)
        {
            /* TODO: Find better solution. */
            if (alert.get("visited"))
                return;

            alert.set("visited", true);

            /* Thanks to redalert.co.il */
            var circle = new google.maps.Circle({
                strokeColor: "red",
                strokeWeight: 1,
                fillColor: "red",
                fillOpacity: 0,
                map: map,
                center: new google.maps.LatLng( alert.get("area_lat"), alert.get("area_long") ),
                radius: 0
            });

            // expand animation
            var opacity = .5;
            var expand = function() {
                var radius = circle.get( "radius" ) + 1500;
                circle.set( "radius", radius );
                if ( radius < 3000 ) {
                    return requestAnimationFrame( expand );
                }

                setTimeout( function() {
                    circle.set( "fillOpacity", opacity );
                    circle.set( "strokeWeight", 0 );
                    fade();
                }, 300 );
            }
            requestAnimationFrame( expand );

            var fade = function() {
                var opacity = circle.get( "fillOpacity" ) - (( window.location.hash == "#slow" ) ? 0.005 : 0.01);
                if ( window.location.hash == "#nofade" && opacity > 0 && opacity < 0.1 ) {
                    return; // no more fading
                }


                circle.set( "fillOpacity", opacity );
                if ( opacity <= 0 ) {
                    return circle.setMap( null );
                }
                requestAnimationFrame( fade );
            }
        });
      }.observes('controller.content.@each'),
});

// Gadi Cohen, nov12, GPLed.   v0.1
// See http://tzeva-adom.com/alerts.html

/**
  * Alerts class constructor.  Initiates a new Alerts object, which handles
  * JSONP long polling to the server (see below).
  * @constructor
  *
  * @param url    Defaults to http://currenthost:8080/redalert
  * <br>          You'll want http://tzeva-adom.com:8080/redalert on external code
  *
  * @return Alerts object
  */
function Alerts(url) {
    this.timeout = 0;
    this.callbacks = [];
    this.sleeptime = 1000;
    if (!url) url = "http://" + window.location.host + ":8080/redalert";
    this.url = url;
    this.lastSuccess = null;
    this.failureCount = 0;
}

/**
  * Specify a callback function to be called whenever there is new data
  * from the server.  The function will be called with the new data as it's
  * only argument.  You may add as many callback functions as required.
  *
  * @param callback   - function reference or anonymous function
  *
  */
Alerts.prototype.callback = function(callback) {
    this.callbacks.push(callback);
}

/**
  * Performs a JSONP "long poll" (a "reverse ajax" technique)
  * This is the main code that interacts with the server to retrieve new information.  With long polling,
  * the XHR request is blocked on the server side (and kept open on the client) until there is new data to
  * send.  It sends the data, closes the connection, and initiates a new connection to wait for data again.
  * JSONP is used to allow for cross-domain requests.
  */
Alerts.prototype.poll = function() { 
    var _this = this;
    $.ajax({
        url: this.url,
        dataType: 'jsonp',
        jsonpCallback: 'redalert',
        success: function(data) {
            _this.lastSuccess = new Date();
                        for (var i=0; i < _this.callbacks.length; i++)
                            _this.callbacks[i](jQuery.parseJSON(data));
            _this.poll();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            _this.failureCount++;
            console.log('Error: ' + textStatus + ' ' + errorThrown + ', sleeping...');
            _this.timeout = setTimeout(function() { _this.poll(); }, _this.sleeptime);
        }
    });
} 

// requestAnimationFrame shim
// http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
var lastTime = 0;
var vendors = ['webkit', 'moz'];
for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame =
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
}

if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
        var id = window.setTimeout(function() { callback(currTime + timeToCall); },
          timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };

if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
    clearTimeout(id);
};