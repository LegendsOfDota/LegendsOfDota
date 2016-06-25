function ScepterStarfallCheck( keys )
	local caster = keys.caster
	local ability = keys.ability

	-- Check if we actually have scepter
	if caster:HasScepter() and caster:IsInvisible() == false then
		local abLevel = ability:GetLevel()

		local abRadius = ability:GetLevelSpecialValueFor('starfall_radius', abLevel - 1)

		-- Look for enemies in range
		local enemies = FindUnitsInRadius(caster:GetTeamNumber(),caster:GetAbsOrigin(),nil,abRadius,DOTA_UNIT_TARGET_TEAM_ENEMY,DOTA_UNIT_TARGET_HERO + DOTA_UNIT_TARGET_BASIC,DOTA_UNIT_TARGET_FLAG_NONE,FIND_ANY_ORDER,false)
	
		-- Loop through enemies and check if it actually sees caster
		for k,v in pairs(enemies) do
			if v:CanEntityBeSeenByMyTeam(caster) and caster:CanEntityBeSeenByMyTeam(v) then
				-- Remove thinker
				caster:RemoveModifierByName("modifier_mirana_starfall_scepter_thinker")

				-- Wait for scepter interval before next starfall
				ability:ApplyDataDrivenModifier(caster,caster,"modifier_mirana_starfall_scepter_cooldown",{})

				ability:OnSpellStart()

				break
			end
		end
	end
end