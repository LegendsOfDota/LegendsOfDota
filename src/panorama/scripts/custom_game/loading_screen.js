"use strict";

// Hooks an events and fires for all the keys
function hookAndFire(tableName, callback) {
    // Listen for phase changing information
    CustomNetTables.SubscribeNetTableListener(tableName, callback);

    // Grab the data
    var data = CustomNetTables.GetAllTableValues(tableName);
    if(data != null) {
        for(var i=0; i<data.length; ++i) {
            var info = data[i];
            callback(tableName, info.key, info.value);
        }
    }
}

// When we get player stats
function onGetPlayerStats(table_name, key, data) {
    // Are we dealing with stats?
    if(key != 'stats') return;

    // Cleanup the stats container
    var statsCon = $('#statsContainer');
    statsCon.RemoveAndDeleteChildren();

    // Create the header
    var statsRow = $.CreatePanel('Panel', statsCon, 'stats_row_header');
    statsRow.BLoadLayout( "file://{resources}/layout/custom_game/stats_row.xml", false, false);
    statsRow.onGetRowData(-1);

    var even = true;

    // Loop over the data
    for(var playerID in data) {
        var statsRow = $.CreatePanel('Panel', statsCon, 'stats_row_' + playerID);
        statsRow.BLoadLayout( "file://{resources}/layout/custom_game/stats_row.xml", false, false);
        statsRow.onGetRowData(parseInt(playerID), data[playerID]);

        even = !even;
        statsRow.SetHasClass('evenStatRow', even);
    }

    // Hide the stupid tip
    $.GetContextPanel().SetHasClass('statsFullyLoaded', true);
}

(function() {
    // The tips we can show
    var tips = [{
        img: 'file://{images}/spellicons/death_prophet_witchcraft.png',
        txt: '#hintWitchCraft'
    }, {
        img: 'file://{images}/spellicons/ogre_magi_multicast.png',
        txt: '#hintMulticast'
    }, {
        img: 'file://{images}/spellicons/invoker_alacrity.png',
        txt: '#hintInvokerSpells'
    }, {
        img: 'file://{images}/spellicons/roshan_bash.png',
        txt: '#hintRoshanSpells'
    }, {
        img: 'file://{images}/spellicons/treant_eyes_in_the_forest.png',
        txt: '#hintUltimates'
    }, {
        img: 'file://{images}/spellicons/witch_doctor_voodoo_restoration.png',
        txt: '#hintInfestHacks'
    }, {
        img: 'file://{images}/items/gem.png',
        txt: '#hintSuggestHint'
    }, {
        img: 'file://{images}/custom_game/hints/hint_empowering_haste.png',
        txt: '#hintEmpoweringHaste'
    }, {
        img: 'file://{images}/items/recipe.png',
        txt: '#hintSuggestBuild'
    }, {
        img: 'file://{images}/items/silver_edge.png',
        txt: '#hintBreakPassives'
    }, {
        img: 'file://{images}/spellicons/night_stalker_darkness.png',
        txt: '#hintInnateAbilities'
    }, {
        img: 'file://{images}/spellicons/weaver_the_swarm.png',
        txt: '#hintReport'
    }, {
        img: 'file://{images}/spellicons/keeper_of_the_light_mana_leak.png',
        txt: '#hintMemoryLeak'
    }];

    // How long to wait before we show the next tip
    var tipDelay = 15;

    // Contains a list of all tip IDs
    var allTips = [];
    var tipUpto = 0;
    for(var i=0; i<tips.length; ++i) {
        allTips.push(i);
    }
    for (var i = allTips.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allTips[i];
        allTips[i] = allTips[j];
        allTips[j] = temp;
    }

    // Sets the hint
    function setHint(img, txt) {
        // Set the image
        var tipImage = $('#LoDLoadingTipImage');
        if(tipImage != null) {
            tipImage.SetImage(img);
        }

        var tipText = $('#LoDLoadingTipText');
        if(tipText != null) {
            tipText.text = txt;
        }
    }

    // Show the next hint
    function nextHint() {
        // Set the next tip
        var tip = tips[allTips[tipUpto++]];
        //var tip = tips[5];
        setHint(tip.img, $.Localize(tip.txt));

        if(tipUpto >= allTips.length) {
            tipUpto = 0;
        }

        // Schedule the next tip
        $.Schedule(tipDelay, function() {
            nextHint();
        });
    }

    function checkIfWeShouldMoveTheHintToTheRight() {
        if(Game.GetState() >= 2) {
            $.GetContextPanel().AddClass('moveHintTheHint');

            // Done
            return;
        }

        $.Schedule(0.1, checkIfWeShouldMoveTheHintToTheRight);
    }

    // Show the first hint
    nextHint();

    // Check if we should move the hint
    checkIfWeShouldMoveTheHintToTheRight();

    // Give a delay, and then hook pregame stuff
    $.Schedule(0.1, function() {
        // Hook getting player data
        hookAndFire('phase_pregame', onGetPlayerStats);
    });
})();
