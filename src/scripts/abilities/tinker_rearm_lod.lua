function rearm_start(keys)
    local caster = keys.caster
    local ability = keys.ability
    local abilityLevel = ability:GetLevel()
    ability:ApplyDataDrivenModifier(caster, caster, 'modifier_rearm_level_' .. abilityLevel .. '_datadriven', {})
end

function rearm_refresh_cooldown(keys)
    local caster = keys.caster
    
    -- Reset cooldown for abilities that is not rearm
    for i = 0, caster:GetAbilityCount() - 1 do
        local ability = caster:GetAbilityByIndex(i)
        if ability and ability ~= keys.ability then
            local timeLeft = ability:GetCooldownTimeRemaining()
            ability:EndCooldown()
            if timeLeft > 30 then 
                ability:StartCooldown(timeLeft - 30) 
            end
        end
    end
	
    -- Put item exemption in here
    local exempt_table = {
        item_black_king_bar = true,
        item_arcane_boots = true,
        item_hand_of_midas = true,
        item_helm_of_the_dominator = true,
        item_refresher = true,
        item_sphere = true,
        item_bottle = true,
        item_necronomicon = true,
        item_necronomicon_2 = true,
        item_necronomicon_3 = true
    }
	
    -- Reset cooldown for items
    for i = 0, 5 do
        local item = caster:GetItemInSlot(i)
        if item and not exempt_table[item:GetAbilityName()] then
            item:EndCooldown()
        end
    end
end
