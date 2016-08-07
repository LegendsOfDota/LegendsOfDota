"use strict";

/*
    Event IO system
    Core to the new GUI
*/

// Init event systems
var eventSystem = function() {
    this.events = {};
}

// Register for an event
eventSystem.prototype.on = function(callbackName, callback) {
    // Ensure we have a store for this event
    if(this.events[callbackName] == null) {
        this.events[callbackName] = [];
    }

    // Add this event callback
    this.events[callbackName].push(callback);
}

// Fire an event
eventSystem.prototype.trigger = function(callbackName, data) {
    // Does the event have any callbacks?
    var callbacks = this.events[callbackName];
    if(callbacks == null) return;

    // Ensure we have some data
    if(data == null) data = {};

    // Run each callback
    for(var i=0; i<callbacks.length; ++i) {
        callbacks[i](data);
    }
}

// Export event system
Game.shared.events = new eventSystem();
