"use strict";

// The ID of a vote we have hidden
var hiddenVote;
var activeVoteData;

// A timer hook
var shouldUpdateTimer = -1;

// When the user wants to open the voting menu
function onBtnOpenVoteSystemPressed() {
	// Toggles the creation menu
	votingToggleCreationMenu();
}

// Hides the votable options part
function hideActiveVoteOptions() {
	$('#voteOptionsContainer').visible = false;
}

// Shows teh votable options part
function showActiveVoteOptions() {
	$('#voteOptionsContainer').visible = true;
}

// When the user presses vote yes
function onBtnOpenVoteYesPressed() {
	// Hide the voting buttons
	hideActiveVoteOptions();

	// Push the vote to the server
	GameEvents.SendCustomGameEventToServer('lodVoteCastVote', {
		vote: 'yes'
	});
}

// When the user presses vote no
function onBtnOpenVoteNoPressed() {
	// Hide the voting buttons
	hideActiveVoteOptions();

	// Push the vote to the server
	GameEvents.SendCustomGameEventToServer('lodVoteCastVote', {
		vote: 'no'
	});
}

// Toggles the voting menu
function votingToggleCreationMenu() {
	var pain = $('#votingVoteCreationMenu');

	if(pain.visible) {
		votingHideCreationMenu();
	} else {
		votingShowCreationMenu();
	}
}

// Hides the voting menu
function votingHideCreationMenu() {
	// Hide it
	$('#votingVoteCreationMenu').visible = false;
}

// Shows the voting menu
function votingShowCreationMenu() {
	// Reset to the main vote screen
	votingDisplayMenu('mainMenu');

	// Show it
	$('#votingVoteCreationMenu').visible = true;
}

// Clears out the vote creation menu
function votingClearMenu() {
	var panelVoteCreation = $('#votingVoteCreationMenu');

	// Delete children
	panelVoteCreation.RemoveAndDeleteChildren();
}

// Creates a sub menu
function votingAddSubMenu(info) {
	// Grab the main panel
	var panelVoteCreation = $('#votingVoteCreationMenu');

	// Create the new panel
	var pan = $.CreatePanel('Panel', panelVoteCreation, 'votingSubMenu_' + info.title);
    pan.BLoadLayout('file://{resources}/layout/custom_game/ingame/ingame_voting_item_basic.xml', false, false);
    pan.parseInfo(info);
}

// Displays a given menu
function votingDisplayMenu(menuName) {
	// Ensure the menu exists
	var info = Game.shared.votingMenus[menuName];
	if(!info) return;

	// Clear the current menu
	votingClearMenu();

	// Grab the items for this menu
	var items = info.items || [];

	// Create each item
	for(var i=0; i<items.length; ++i) {
		// Grab the item
		var item = items[i];

		// Add the sub menu
		votingAddSubMenu(item);
	}
}

// Add a voting range
function votingAddRange(info, storeInto) {
	// Grab the main panel
	var panelVoteCreation = $('#votingVoteCreationMenu');

	// Grab the default
	var defaultValue = info.default;
	if(info.linkTo && Game.shared.optionValueList[info.linkTo] != null) {
		defaultValue = Game.shared.optionValueList[info.linkTo];
	}

	// Store the default value
	storeInto[info.fieldName] = defaultValue;

	// Create the new panel
	var pan = $.CreatePanel('Panel', panelVoteCreation, 'votingSubMenu_' + info.title);
    pan.BLoadLayout('file://{resources}/layout/custom_game/ingame/ingame_voting_item_basic.xml', false, false);
    pan.parseInfo(info);
    pan.addSliderInput(info.step, info.min, info.max, defaultValue, function(newValue) {
    	storeInto[info.fieldName] = newValue;
    });
}

// Adds a voting toggle button
function votingAddToggle(info, storeInto) {
	// Grab the main panel
	var panelVoteCreation = $('#votingVoteCreationMenu');

	// Grab the default
	var defaultValue = info.default;
	if(info.linkTo && Game.shared.optionValueList[info.linkTo] != null) {
		// The aim of a toggle is to change the value, so, invert the currently selected value
		if(Game.shared.optionValueList[info.linkTo] == 0) {
			defaultValue = 1;
		} else {
			defaultValue = 0;
		}
	}

	// Store the default value
	storeInto[info.fieldName] = defaultValue;

	// Create the new panel
	var pan = $.CreatePanel('Panel', panelVoteCreation, 'votingSubMenu_' + info.title);
    pan.BLoadLayout('file://{resources}/layout/custom_game/ingame/ingame_voting_item_basic.xml', false, false);
    pan.parseInfo(info);
    pan.addToggleInput(defaultValue, $.Localize(info.textOff), $.Localize(info.textOn), function(newValue) {
    	storeInto[info.fieldName] = newValue;
    });
}

// Displays a menu where you confirm a vote
function votingConfirmVote(info) {
	// Ensure we have some info
	if(info == null) return;

	// Clear the old menu
	votingClearMenu();

	// Add the cancel button
	votingAddSubMenu({
		title: 'votingCancelVote',
		des: 'votingCancelVoteDes',
		link: info.back
	});

	// Add the title card
	votingAddSubMenu({
		title: info.title,
		des: info.des
	});

	// A store for data
	var data = {};

	// Add any options
	if(info.options) {
		for(var i=0; i<info.options.length; ++i) {
			var opt = info.options[i];

			switch(opt.sort) {
				case 'range':
					votingAddRange(opt, data);
				break;

				case 'toggle':
					votingAddToggle(opt, data);
				break;
			}
		}
	}

	// Add the create vote option
	votingAddSubMenu({
		title: 'votingCreateVote',
		des: 'votingCreateVoteDes',
		callback: function(theInfo) {
			// Create the vote
			createVote(info, data);
		}
	});;
}

// Creates a vote based on the given info
function createVote(info, data) {
	// Hide the menu
	votingHideCreationMenu();

	// Push the vote to the server
	GameEvents.SendCustomGameEventToServer('lodVoteCreate', {
		info: info,
		data: data
	});
}

// When we get ingame data
function OnGetIngameData(table_name, key, data) {
	if(key == 'vote') {
		OnGetVoteData(table_name, key, data);
		return;
	}
}

function setVoteExpireTime(endOfLife) {
	// Create a new ID
	var myID = ++shouldUpdateTimer;

	var updateTimer = function() {
		// Is this still the most current timer?
		if(myID != shouldUpdateTimer) return;

		// Calculate how long is left
		var now = Game.Time();
		var timeLeft = Math.ceil(endOfLife - now);
		if(timeLeft <= 0) timeLeft = '';

		// Update the text
		$('#votingActiveVoteTimer').text = timeLeft;

		// Schedule the next one
		$.Schedule(0.1, updateTimer);
	}

	// Start the timer
	updateTimer();
}

// When we get vote data
function OnGetVoteData(table_name, key, data) {
	var playerID = Players.GetLocalPlayer();
	var plyVotes = data.plyVotes;

	// Store it
	activeVoteData = data;

	// Show or hide the player vote counter
	var voteButtonsCon = $('#voteOptionsContainer');
	if(plyVotes[playerID] || data.finished) {
		voteButtonsCon.visible = false;
	} else {
		voteButtonsCon.visible = true;
	}

	// Hide finish messages
	$('#lodVotePassed').visible = false;
	$('#lodVoteFailed').visible = false;

	if(data.finished) {
		if(data.passed) {
			$('#lodVotePassed').visible = true;
		} else {
			$('#lodVoteFailed').visible = true;
		}
	}

	// Update vote counts
	$('#lodVoteCountYes').text = data.totalYes;
	$('#lodVoteCountNo').text = data.totalNo;

	// Update title
	$('#voteTitle').text = $.Localize(data.voteTitle);

	// Grab player name
	$('#voteBy').text = '';
	var plyInfo = Game.GetPlayerInfo(data.playerID);
	if(plyInfo != null) {
		var plyName = plyInfo.player_name;

		if(plyName != null) {
			$('#voteBy').text = $.Localize('voteCreatedBy').replace(/\{plyName\}/g, plyName)
		}
	}

	// Update description
	$('#voteDes').text = '';
	if(data.voteDes != null) {
		var voteDes = $.Localize(data.voteDes);

		if(data.voteDesArgs != null) {
			for(var key in data.voteDesArgs) {
				voteDes = voteDes.replace(new RegExp('\\{' + key + '\\}', 'g'), $.Localize(data.voteDesArgs[key]));
			}
		}

		$('#voteDes').text = voteDes;
	}

	// Show it
	$('#votingActiveVote').visible = true;

	// Should we show it?
	if(data.hideTime) {
		var now = Game.Time();
		if(now > data.hideTime) {
			// Hide now
			$('#votingActiveVote').visible = false;
			return;
		} else {
			// Hide in a few moments
			var theVoteID = data.voteID;
			$.Schedule(data.hideTime - now, function() {
	            if(theVoteID == data.voteID) {
	            	$('#votingActiveVote').visible = false;
	            	return;
	            }
	        });
		}

		// Update timer
		setVoteExpireTime(data.hideTime);
	} else {
		if(hiddenVote == data.voteID) {
			$('#votingActiveVote').visible = false;
			return;
		}

		// Update timer
		setVoteExpireTime(data.endTime);
	}
}

// Close the active vote panel
function closeActiveVotePanel() {
	// Hide it
	$('#votingActiveVote').visible = false;

	// Stop it from popping back up
	if(activeVoteData != null) {
		hiddenVote = activeVoteData.voteID;
	}
}

// Hook everything
(function() {
	// Define exports
	Game.shared.voting = {
		votingDisplayMenu: votingDisplayMenu,
		votingConfirmVote: votingConfirmVote,
		votingHideCreationMenu: votingHideCreationMenu
	}

	// Hook vote changes
	Game.shared.hookAndFire('phase_ingame', OnGetIngameData);

	// Register for notifications
	Game.shared.registerNotifications($('#lodNotificationArea'));
})();