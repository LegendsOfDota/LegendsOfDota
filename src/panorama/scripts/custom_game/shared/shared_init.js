"use strict";

// Cleanup our shared vars
Game.shared = {};

// Map of optionName -> Value
Game.shared.optionValueList = {};

// Hooks an events and fires for all the keys
Game.shared.hookAndFire = function(tableName, callback) {
    // Listen for phase changing information
    CustomNetTables.SubscribeNetTableListener(tableName, callback);

    // Grab the data
    var data = CustomNetTables.GetAllTableValues(tableName);
    for(var i=0; i<data.length; ++i) {
        var info = data[i];
        callback(tableName, info.key, info.value);
    }
}

// Hooks a change event for text boxes
Game.shared.addInputChangedEvent = function(panel, callback, extraInfo) {
	if(extraInfo == null) extraInfo = {};

    var shouldListen = false;
    var checkRate = 0.25;
    var currentString = panel.text;

    var inputChangedLoop = function() {
        // Check for a change
        if(currentString != panel.text) {
            // Update current string
            currentString = panel.text;

            // Run the callback
            callback(currentString);
        }

        if(shouldListen) {
            $.Schedule(checkRate, inputChangedLoop);
        }
    }

    panel.SetPanelEvent('onfocus', function() {
        // Enable listening, and monitor the field
        shouldListen = true;
        inputChangedLoop();

        // Extra events
        if(extraInfo.onfocus) extraInfo.onfocus();
    });

    panel.SetPanelEvent('onblur', function() {
        // No longer listen
        shouldListen = false;

        // Extra events
        if(extraInfo.onblur) extraInfo.onblur();
    });
}

// Adds a notification
var notifcationTotal = 0;
var notificationRoot = null;
Game.shared.addNotification = function(options) {
    // If we have no notification root, don't do anything
    if(notificationRoot == null) return;

    // Grab useful stuff
    var notificationID = ++notifcationTotal;

    options = options || {};
    var text = options.text || '';
    var params = options.params || [];
    var sort = options.sort || 'lodInfo';
    var duration = options.duration || 5;

    var realText = $.Localize(text);
    for(var key in params) {
        var toAdd = $.Localize(params[key]);

        realText = realText.replace(new RegExp('\\{' + key + '\\}', 'g'), toAdd);
    }


    // Create the panel
    var notificationPanel = $.CreatePanel('Panel', notificationRoot, 'notification_' + notificationID);
    var textContainer = $.CreatePanel('Label', notificationPanel, 'notification_text_' + notificationID);

    // Push the style and text
    notificationPanel.AddClass('lodNotification');
    notificationPanel.AddClass('lodNotificationLoading');
    notificationPanel.AddClass(sort);
    textContainer.text = realText;

    // Delete it after a bit
    $.Schedule(duration, function() {
        notificationPanel.RemoveClass('lodNotificationLoading');
        notificationPanel.AddClass('lodNotificationRemoving');

        $.Schedule(0.5, function() {
            notificationPanel.DeleteAsync(0);
        });
    });
}

// Are we the host?
Game.shared.isHost = function() {
    var playerInfo = Game.GetLocalPlayerInfo();
    if (!playerInfo) return false;
    return playerInfo.player_has_host_privileges;
}

// Update the CSS on a panel to tell what phase we are in
Game.shared.updatePhaseCSS = function(panel) {
    panel.SetHasClass('phase_loading', Game.shared.currentPhase == Game.shared.PHASE_LOADING);
    panel.SetHasClass('phase_option_selection', Game.shared.currentPhase == Game.shared.PHASE_OPTION_SELECTION);
    panel.SetHasClass('phase_option_voting', Game.shared.currentPhase == Game.shared.PHASE_OPTION_VOTING);
    panel.SetHasClass('phase_banning', Game.shared.currentPhase == Game.shared.PHASE_BANNING);
    panel.SetHasClass('phase_selection', Game.shared.currentPhase == Game.shared.PHASE_SELECTION);
    panel.SetHasClass('phase_all_random', Game.shared.currentPhase == Game.shared.PHASE_RANDOM_SELECTION);
    panel.SetHasClass('phase_drafting', Game.shared.currentPhase == Game.shared.PHASE_DRAFTING);
    panel.SetHasClass('phase_review', Game.shared.currentPhase == Game.shared.PHASE_REVIEW);
    panel.SetHasClass('phase_ingame', Game.shared.currentPhase == Game.shared.PHASE_INGAME);
}

// Updates the CSS on a panel to tell what phase is selected
Game.shared.updateSelectedCSS = function(panel) {
    panel.SetHasClass('phase_option_selection_selected', Game.shared.selectedPhase == Game.shared.PHASE_OPTION_SELECTION);
    panel.SetHasClass('phase_option_voting_selected', Game.shared.selectedPhase == Game.shared.PHASE_OPTION_VOTING);
    panel.SetHasClass('phase_banning_selected', Game.shared.selectedPhase == Game.shared.PHASE_BANNING);
    panel.SetHasClass('phase_selection_selected', Game.shared.selectedPhase == Game.shared.PHASE_SELECTION);
    panel.SetHasClass('phase_all_random_selected', Game.shared.selectedPhase == Game.shared.PHASE_RANDOM_SELECTION);
    panel.SetHasClass('phase_drafting_selected', Game.shared.selectedPhase == Game.shared.PHASE_DRAFTING);
    panel.SetHasClass('phase_review_selected', Game.shared.selectedPhase == Game.shared.PHASE_REVIEW);
}

// Resiteres the current notification root
Game.shared.registerNotifications = function(panel) {
    notificationRoot = panel;
}

// Stub
Game.shared.focusNothing = function(){};

// Phases
Game.shared.PHASE_LOADING = 1;          // Waiting for players, etc
Game.shared.PHASE_OPTION_VOTING = 2;    // Selection options
Game.shared.PHASE_OPTION_SELECTION = 3; // Selection options
Game.shared.PHASE_BANNING = 4;          // Banning stuff
Game.shared.PHASE_SELECTION = 5;        // Selecting heroes
Game.shared.PHASE_DRAFTING = 6;         // Place holder for drafting mode
Game.shared.PHASE_RANDOM_SELECTION = 7; // Random build selection (For All Random)
Game.shared.PHASE_REVIEW = 8;           // Review Phase
Game.shared.PHASE_INGAME = 9;           // Game has started

// Constants
Game.shared.maxSlots = 6;

// Current phase
Game.shared.currentPhase = Game.shared.PHASE_LOADING;

// Are we a premium player?
Game.shared.isPremiumPlayer = false;

// Used to tell when a phase ends
Game.shared.endOfTimer = -1;

// Used for freezing the timer
Game.shared.freezeTimer = -1;

// Waiting for preache
Game.shared.waitingForPrecache = true;

// Stores vote counts
Game.shared.voteCounts = {};
