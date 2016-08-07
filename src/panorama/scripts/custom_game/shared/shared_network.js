"use strict";

/*
    Handles server communication
*/

// When a player's selected hero changes
function onSelectedHeroesChanged(table_name, key, data) {
    // Grab data
    var playerID = data.playerID;
    var heroName = data.heroName;

    // Store the change
    Game.shared.selectedHeroes[playerID] = heroName;

    // Call the event
    Game.shared.events.trigger('heroChanged', {
        playerID: playerID,
        heroName: heroName
    });
}

/*
    Network Events - Hero Selection
*/

// Updates our selected hero
Game.shared.chooseHero = function(heroName) {
    GameEvents.SendCustomGameEventToServer('lodChooseHero', {
        heroName:heroName
    });
};

// Tries to ban a hero
Game.shared.banHero = function(heroName) {
    GameEvents.SendCustomGameEventToServer('lodBan', {
        heroName:heroName
    });
};

// Updates our selected primary attribute
Game.shared.choosePrimaryAttr = function(newAttr) {
    GameEvents.SendCustomGameEventToServer('lodChooseAttr', {
        newAttr:newAttr
    });
};

// Attempts to ban an ability
Game.shared.banAbility = function(abilityName) {
    var theSkill = abilityName;

    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodBan', {
        abilityName: abilityName
    });
};

// Updates our selected abilities
Game.shared.chooseNewAbility = function(slot, abilityName) {
    var theSkill = abilityName;

    // Can't select nothing
    if(theSkill.length <= 0) return;

    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodChooseAbility', {
        slot: slot,
        abilityName: abilityName
    });
};

// Swaps two slots
Game.shared.swapSlots = function(slot1, slot2) {
    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodSwapSlots', {
        slot1: slot1,
        slot2: slot2
    });
};

// Do all hooks, etc
(function() {
    // Listen for notifications
    GameEvents.Subscribe('lodNotification', function(data) {
        // Add a notification
        Game.shared.addNotification(data);
    });

    // Add hooks
    Game.shared.hookAndFire('selected_heroes', onSelectedHeroesChanged);
})();
