"use strict";

// Have we spawned a hero builder?
var spawnedHeroBuilder = false;

// When we get ingame data
function onGetIngameData(table_name, key, data) {
    if(key == 'enableHeroEditor') {
        // Voting disabled :(
        $('#btnOpenHeroBuilder').visible = true;
    }
}

// Play wants to open the hero builder
function onBtnOpenHeroBuilderPressed() {
    if(!spawnedHeroBuilder) {
        spawnedHeroBuilder = true;

        // Spawn the hero builder
        var heroBuilderPanel = $.CreatePanel('Panel', $('#heroBuilderGoesHero'), '');
        heroBuilderPanel.BLoadLayout('file://{resources}/layout/custom_game/shared/hero_builder/hero_builder_main.xml', false, false);

        // Boot it into selection mode
        heroBuilderPanel.SetHasClass('phase_ingame', true);
        heroBuilderPanel.SetHasClass('phase_selection_selected', true);
    }

    // Hide the hero selection when spawn hero is pressed
    Game.shared.events.on('heroSpawnedPressed', function() {
        $('#heroBuilderGoesHero').visible = false;
    });

    // Make it visible
    $('#heroBuilderGoesHero').visible = true;
}

// Init
(function() {
    // Hook vote changes
    Game.shared.hookAndFire('phase_ingame', onGetIngameData);
})();