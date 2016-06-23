pudge_flesh_heap_int = class({})
LinkLuaModifier( "modifier_flesh_heap_int", "scripts/vscripts/../abilities/modifiers/modifier_flesh_heap_int.lua" ,LUA_MODIFIER_MOTION_NONE )


function pudge_flesh_heap_int:GetIntrinsicModifierName()
	return "modifier_flesh_heap_int"
end

--------------------------------------------------------------------------------

function pudge_flesh_heap_int:OnHeroDiedNearby( hVictim, hKiller, kv )
	if hVictim == nil or hKiller == nil then
		return
	end
	if hVictim:IsIllusion() then
		return
	end

	if hVictim:GetTeamNumber() ~= self:GetCaster():GetTeamNumber() and self:GetCaster():IsAlive() then
		self.fleshHeapRange = self:GetSpecialValueFor( "flesh_heap_range" )
		local vToCaster = self:GetCaster():GetOrigin() - hVictim:GetOrigin()
		local flDistance = vToCaster:Length2D()
		if hKiller == self:GetCaster() or self.fleshHeapRange >= flDistance then
			if self.nKills == nil then
				self.nKills = 0
			end

			self.nKills = self.nKills + 1

			local hBuff = self:GetCaster():FindModifierByName( "modifier_flesh_heap_int" )
			if hBuff ~= nil then
				hBuff:SetStackCount( self.nKills )
				self:GetCaster():CalculateStatBonus()
			end

			local nFXIndex = ParticleManager:CreateParticle( "particles/units/heroes/hero_pudge/pudge_fleshheap_count.vpcf", PATTACH_OVERHEAD_FOLLOW, self:GetCaster() )
			ParticleManager:SetParticleControl( nFXIndex, 1, Vector( 1, 0, 0 ) )
			ParticleManager:ReleaseParticleIndex( nFXIndex )
		end
	end
end

--------------------------------------------------------------------------------

function pudge_flesh_heap_int:GetFleshHeapKills()
	if self.nKills == nil then
		self.nKills = 0
	end
	return self.nKills
end
 
--------------------------------------------------------------------------------
