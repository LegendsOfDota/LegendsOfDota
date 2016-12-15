var fs = require('fs')

// Script directories
var settings = require('./settings.json');                              // The settings file
var scriptDir = settings.scriptDir + '/';                               // The directory where dota scripts are placed
var scriptDirOut = settings.scriptDirOut;                               // The directory where our files are outputted
var resourcePath = settings.dotaDir + 'game/dota/resource/';   // The directory to read resource files from
var customDir = settings.customDir;                                     // The directory where our mods are read from, to be merged in
var customAbilitiesLocation = '../src/scripts/npc/npc_abilities_custom.txt'
var langDir = '../src/localization/';

// Code needed to do multipliers
var spellMult = require('./spellMult.json');

// Create the output folder
if(!fs.existsSync(scriptDirOut)) fs.mkdirSync(scriptDirOut);

// Create the output folder
//if(!fs.existsSync(scriptDirOut)) fs.mkdirSync(scriptDirOut);

// Store for our custom stuff
var customAbilities = {};
var customUnits = {};
//var customItems = {};
//var items = {};
var abilities = {};

/*
    Prepare language files
*/

var langs = ['english', 'schinese'];
var langIn = {};
var langOut = {};
var specialChar;    // Special character needed for doto encoding

// theString is the string we search for and use as a key to store in
// if theString can't be find, search using altString
// search in actual language, if that fails, search in english, if that fails, commit suicide
function generateLanguage(theString, altString, appendOnEnd) {
    // Grab a reference to english
    var english = langIn.english;

    if(appendOnEnd == null) appendOnEnd = '';

    for(var i=0; i<langs.length; ++i) {
        // Grab a language
        var lang = langs[i];
        var langFile = langIn[lang];
        var storeTo = langOut[lang];

        if(langFile[theString]) {
            storeTo[theString] = langFile[theString] + appendOnEnd;
        } else if(langFile[altString]) {
            storeTo[theString] = langFile[altString] + appendOnEnd;
        } else if(english[theString]) {
            storeTo[theString] = english[theString] + appendOnEnd;
        } else if(english[altString]) {
            storeTo[theString] = english[altString] + appendOnEnd;
        } else if(storeTo[altString]) {
            storeTo[theString] = storeTo[altString] + appendOnEnd;
        } else {
            console.log('Failed to find ' + theString);
        }

        if(!langFile[theString]) langFile[theString] = storeTo[theString];
    }
}

var generateAfter = [];
function generateLanguageAfter(theString, altString, appendOnEnd) {
    generateAfter.push([theString, altString, appendOnEnd]);
}

function clearGenerateAfter() {
    generateAfter = [];
}

// Read in our language files
function prepareLanguageFiles(next) {
    var ourData = ''+fs.readFileSync(langDir + 'addon_english.txt');
    var english = parseKV(ourData).addon;

    specialChar = fs.readFileSync(resourcePath + 'dota_english.txt', 'utf16le').substring(0, 1);

    for(var i=0; i<langs.length; ++i) {
        // Grab a language
        var lang = langs[i];

        var data = fs.readFileSync(resourcePath + 'dota_' + lang + '.txt', 'utf16le').substring(1);

        // Load her up
        langIn[lang] = parseKV(data).lang.Tokens;
        langOut[lang] = {};

        var toUse;
        if(fs.existsSync(langDir + 'addon_' + lang + '.txt')) {
            var ourData
            if(lang == 'english') {
                ourData = ''+fs.readFileSync(langDir + 'addon_' + lang + '.txt');
            } else {
                ourData = ''+fs.readFileSync(langDir + 'addon_' + lang + '.txt', 'utf16le').substring(1);
            }

            toUse = parseKV(ourData).addon;
        } else {
            toUse = english;
        }

        for(var key in english) {
            if(toUse[key]) {
                langOut[lang][key] = toUse[key];
            } else {
                langOut[lang][key] = english[key];
            }
        }

        for(var key in toUse) {
            if(!langIn[lang][key]) {
                langIn[lang][key] = toUse[key];
            }
        }
    }

    console.log('Done loading languages!');

    // Run the next step if there is one
    if(next) next();
}

/*
    Precache generator
*/

function generatePrecacheData(next) {
    // Precache generator
    fs.readFile(scriptDir+'npc_heroes.txt', function(err, rawHeroes) {
        console.log('Loading heroes...');
        var rootHeroes = parseKV(''+rawHeroes);

        var newKV = {};

        // List of heroes to ignore differs based on s1 and s2
        // In s2, no bots are supported, so we can just strip every hero
        var ignoreHeroes = {
            npc_dota_hero_techies: true,
            npc_dota_hero_gyrocopter: true,
            npc_dota_hero_riki: true
        };

        var heroes = rootHeroes.DOTAHeroes;
        for(var name in heroes) {
            if(name == 'Version') continue;
            if(name == 'npc_dota_hero_base') continue;

            var data = heroes[name];

            if(!ignoreHeroes[name]) {
                newKV[name+'_lod'] = {
                    override_hero: name,
                    AbilityLayout: 6
                }

                if(data.BotImplemented != 1) {
                    //newKV[name+'_lod'].Ability1 = 'attribute_bonus';

                    for(var i=1;i<=32;++i) {
                        var txt = heroes[name]['Ability' + i];
                        if(txt) {
                            if(txt[0].indexOf('special_bonus_') != -1) {
                                //newKV[name+'_lod']['Ability' + i] = txt;
                            } else {
                                newKV[name+'_lod']['Ability' + i] = '';
                            }

                        }
                    }
                }
            }

            // Check if they are melee
            if(data.AttackCapabilities == 'DOTA_UNIT_CAP_MELEE_ATTACK') {
                if(!newKV[name+'_lod']) {
                    newKV[name+'_lod'] = {
                        override_hero: name
                    }
                }

                // Give them projectile speed + model
                newKV[name+'_lod'].ProjectileSpeed = 1000
                newKV[name+'_lod'].ProjectileModel = 'luna_base_attack'
            }

            // Add ability layout = 6
            if(!newKV[name+'_lod']) {
                newKV[name+'_lod'] = {
                    override_hero: name
                }
            }
            newKV[name+'_lod'].AbilityLayout = 6;

            // Source2 precache
            customUnits['npc_precache_'+name] = {
                BaseClass: 'npc_dota_creep',
                precache: {
                    particle_folder: data.particle_folder,
                    soundfile: data.GameSoundsFile
                }
            }

            // Extra precache stuff
            if(data.precache) {
                for(var key in data.precache) {
                    customUnits['npc_precache_'+name].precache[key] = data.precache[key];
                }
            }
        }

        // Techies override prcaching
        customUnits.npc_precache_npc_dota_hero_techies.precache.model = 'models/heroes/techies/fx_techiesfx_mine.vmdl';

        // Store the hero data
        fs.writeFile(scriptDirOut+'npc_heroes_custom.txt', toKV(newKV, 'DOTAHeroes'), function(err) {
            if (err) throw err;

            console.log('Done saving custom heroes!');

            // Continue, if there is something else to run
            if(next) next();
        });
    });
}

/*
    Custom file mergers
*/

/*function loadItems(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(scriptDir+'items.txt', function(err, rawItems) {
        console.log('Loading items...');
        items = parseKV(''+rawItems).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}*/

function loadAbilities(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(scriptDir+'npc_abilities.txt', function(err, rawAbs) {
        console.log('Loading abilities...');
        abilities = parseKV(''+rawAbs).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadCustomUnits(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(customDir+'npc_units_custom.txt', function(err, rawCustomUnits) {
        console.log('Loading custom units...');
        customUnits = parseKV(''+rawCustomUnits).DOTAUnits;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadCustomAbilities(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(customAbilitiesLocation, function(err, rawCustomAbilities) {
        console.log('Loading custom abilities...');
        customAbilities = parseKV(''+rawCustomAbilities).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

/*
	Process Skill Warnings
*/

function generateSkillWarnings(next) {
	// Grab a reference to english
    var english = langIn.english;

    for(var word in english) {
    	if(word.indexOf('warning_') == 0) {
    		var value = english[word];

    		var abilityName = word.replace('warning_', '');

    		for(var i=0; i<langs.length; ++i) {
    			// Grab a language
		        var lang = langs[i];
		        var langFile = langIn[lang];
		        var storeTo = langOut[lang];

		        var storeValue = value;

		        // Does this language have a different translation of the word?
		        if(langFile[word]) {
		        	storeValue = langFile[word];
		        }

		        // Do we have anything to change?
		        var searchKey = 'DOTA_Tooltip_ability_' + abilityName+ '_Description';
		        if(langFile[searchKey]) {
		        	storeValue = langFile[searchKey] + '<br><br>' + storeValue + '<br>';
		        }

		        // Store it
		        storeTo[searchKey] = storeValue;
    		}
    	}
    }

    // Continue
    next();
}

/*
    Helper functions
*/

// Round to places decimal places
function r(value, places) {
    for(var i=0; i<places; i++) {
        value *= 10;
    }

    value = Math.round(value);

    for(var i=0; i<places; i++) {
        value /= 10;
    }

    return value;
}

function clone(x) {
   if (x === null || x === undefined)
        return x;
    if (x.clone)
        return x.clone();
    if (x.constructor == Array)
    {
        var r = [];
        for (var i=0,n=x.length; i<n; i++)
            r.push(clone(x[i]));
        return r;
    }
    if(typeof(x) == 'object') {
        var y = {};
        for(var key in x) {
            y[key] = clone(x[key]);
        }
        return y;
    }
    return x;
}

/*
Parses most of a KV file

Mostly copied from here:
https://github.com/Matheus28/KeyValue/blob/master/m28/keyvalue/KeyValue.hx
*/
var TYPE_BLOCK = 0;
function parseKV(data) {
    // Make sure we have some data to work with
    if(!data) return null;

    var tree = [{}];
    var treeType = [TYPE_BLOCK];
    var keys = [null];

    var i = 0;
    var line = 1;

    while(i < data.length) {
        var chr = data.charAt(i);

        if(chr == ' ' || chr == '\t') {
            // Ignore white space
        } else if(chr == '\n') {
            // We moved onto the next line
            line++;
            if(data.charAt(i+1) == '\r') i++;
        } else if(chr == '\r') {
            // We moved onto the next line
            line++;
            if(data.charAt(i+1) == '\n') i++;
        } else if(chr == '/') {
            if(data.charAt(i+1) == '/') {
                // We found a comment, ignore rest of the line
                while(++i < data.length) {
                    chr = data.charAt(i);

                    // Check for new line
                    if(chr == '\n') {
                        if(data.charAt(i+1) == '\r') ++i;
                        break;
                    }
                    if(chr == '\r') {
                        if(data.charAt(i+1) == '\n') ++i;
                        break;
                    }
                }

                // We are on a new line
                line++;
            }
        } else if(chr == '"') {
            var resultString = '';
            i++;

            while(i < data.length) {
                chr = data.charAt(i);
                if(chr == '"') break;

                if(chr == '\n') {
                    // We moved onto the next line
                    line++;
                    if(data.charAt(i+1) == '\r') i++;
                } else if(chr == '\r') {
                    // We moved onto the next line
                    line++;
                    if(data.charAt(i+1) == '\n') i++;
                } else if(chr == '\\') {
                    i++;
                    // Gran the mext cjaracter
                    chr = data.charAt(i);

                    // Check for escaped characters
                    switch(chr) {
                        case '\\':chr = '\\'; break;
                        case '"': chr = '"'; break;
                        case '\'': chr = '\''; break;
                        case 'n': chr = '\n'; break;
                        case 'r': chr = '\r'; break;
                        default:
                            chr = '\\';
                            i--;
                        break;
                    }
                }

                resultString += chr;
                i++;
            }

            if (i == data.length || chr == '\n' || chr == '\r') throw new Error("Unterminated string at line " + line);

            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                if (keys[keys.length - 1] == null) {
                    keys[keys.length - 1] = resultString;
                }else {
                    if(tree[tree.length - 1][keys[keys.length - 1]] == null) {
                        tree[tree.length - 1][keys[keys.length - 1]] = [];
                    }
                    tree[tree.length - 1][keys[keys.length - 1]].push(resultString);
                    keys[keys.length - 1] = null;
                }
            }

            // Check if we need to reparse the character that ended this string
            if(chr != '"') --i;
        } else if(chr == '{') {
            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                if (keys[keys.length - 1] == null) {
                    throw new Error("A block needs a key at line " + line + " (offset " + i + ")");
                }
            }

            tree.push({});
            treeType.push(TYPE_BLOCK);
            keys.push(null);
        } else if (chr == '}') {
            if (tree.length == 1) {
                throw new Error("Mismatching bracket at line " + line + " (offset " + i + ")");
            }
            if (treeType.pop() != TYPE_BLOCK) {
                throw new Error("Mismatching brackets at line " + line + " (offset " + i + ")");
            }
            keys.pop();
            var obj = tree.pop();

            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                tree[tree.length - 1][keys[keys.length - 1]] = obj;
                keys[keys.length - 1] = null;
            }else {
                tree[tree.length - 1].push(obj);
            }
        } else {
            console.log("Unexpected character \"" + chr + "\" at line " + line + " (offset " + i + ")");

            // Skip to next line
            while(++i < data.length) {
                chr = data.charAt(i);

                // Check for new line
                if(chr == '\n') {
                    if(data.charAt(i+1) == '\r') ++i;
                    break;
                }
                if(chr == '\r') {
                    if(data.charAt(i+1) == '\n') ++i;
                    break;
                }
            }

            // We are on a new line
            line++;

            // Move onto the next char
            i++;
        }

        i++;
    }

    if (tree.length != 1) {
        throw new Error("Missing brackets");
    }

    return tree[0];
}

function escapeString(str) {
    return str.replace(/\\/gm, '\\\\').replace(/\"/gm, '\\"').replace(/(\r\n|\n|\r|\n\r)/gm, '\\n');
}

function toKV(obj, key) {
    var myStr = '';

    if(obj == null) {
        // Nothing to return
        return '';
    } else if (typeof obj == 'number') {
        return '"' + escapeString(key) + '""' + obj + '"';
    } else if (typeof obj == 'boolean') {
        return '"' + escapeString(key) + '""' + obj + '"';
    } else if (typeof obj == 'string') {
        return '"' + escapeString(key) + '""' + escapeString(obj) + '"';
    } else if(obj instanceof Array) {
        // An array of strings
        for(var i=0; i<obj.length; i++) {
            myStr = myStr + '"' + escapeString(key) + '"\n"' + escapeString(obj[i]) + '"';
        }

        return myStr;
    } else {
        // An object
        for(var entry in obj) {
            myStr += toKV(obj[entry], entry)
        }

        if(key != null) {
            return '"' + escapeString(key) + '"{\n' + myStr + '}';
        } else {
            return myStr;
        }
    }
}

/*
    Run everything
*/

// Prepare hte languge files
prepareLanguageFiles(function() {
    // Load our custom units
    loadCustomUnits(function() {
        // Load abilities
        loadAbilities(function() {
            // Load items
            //loadItems(function() {
                // Load our custom items
                //loadCustomItems(function() {
                    // Load our custom abilities
                    loadCustomAbilities(function() {
                        // Generate the custom item abilities
                        //generateAbilityItems(function() {
                            // Generate our precache data
                            generatePrecacheData(function() {
                                //doCSP(function() {
                                    //doLvl1Ults(function() {
                                    	generateSkillWarnings(function() {
                                    		// Output language files
	                                        for(var i=0; i<langs.length; ++i) {
	                                            (function(lang) {
	                                                fs.writeFile(scriptDirOut+'addon_' + lang + '_token.txt', specialChar + toKV({Tokens: langOut[lang]}, 'lang'), 'utf16le', function(err) {
                                                        if (err) throw err;

                                                        console.log('Finished saving ' + lang + '!');
                                                    });

                                                    fs.writeFile(scriptDirOut+'addon_' + lang + '.txt', specialChar + toKV(langOut[lang], 'addon'), 'utf16le', function(err) {
                                                        if (err) throw err;

                                                        console.log('Finished saving ' + lang + '!');
                                                    });
	                                            })(langs[i]);
	                                        }

	                                        // Output custom files

	                                        fs.writeFile(scriptDirOut+'npc_units_custom.txt', toKV(customUnits, 'DOTAUnits'), function(err) {
	                                            if (err) throw err;

	                                            console.log('Done saving custom units file!');
	                                        });
                                    	});
                                    //});
                                //});
                            });
                        //});
                    });
                //});
            //});
        });
    });
});
