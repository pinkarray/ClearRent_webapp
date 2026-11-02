'use client'

import { useEffect, useState } from 'react'
import {
  FLOORS,
  STRUCTURES,
  UNIT_TYPES,
  buildingLetter,
  letterNumber,
  myBuildings,
  structureLabel,
  unitsInBuilding,
  type Building,
  type ExistingUnit,
} from '../lib/buildings'
import { propertyTypeLabel } from '../lib/format'
import type { UnitInput } from '../lib/create-listing'

/**
 * One unit inside a building, as the app's letting step asks it: which
 * building (an existing one, or a new one with its structure), what the unit
 * is and its number, which building of a compound, the floor, and what the
 * tenant shares.
 */
export type UnitDraft = {
  /** The existing building picked; null while creating one or before choosing. */
  buildingId: string | null
  creating: boolean
  newName: string
  newStructure: string
  /** The picked existing building's structure. */
  siteStructure: string
  unitType: string
  unitNumber: number
  /** On a compound: which of its buildings, and which one of that kind. */
  compoundStructure: string
  compoundNumber: number
  floor: string
  bathroomAccess: string
  toiletAccess: string
  kitchenAccess: string
  livingRoomAccess: string
  /** Units already in the picked building, for the name-taken check. */
  existing: ExistingUnit[]
}

export const EMPTY_UNIT: UnitDraft = {
  buildingId: null,
  creating: false,
  newName: '',
  newStructure: '',
  siteStructure: '',
  unitType: '',
  unitNumber: 1,
  compoundStructure: '',
  compoundNumber: 1,
  floor: '',
  bathroomAccess: 'private',
  toiletAccess: 'private',
  kitchenAccess: 'private',
  livingRoomAccess: 'private',
  existing: [],
}

function site(u: UnitDraft): string {
  return u.creating ? u.newStructure : u.siteStructure
}

function unitLabel(u: UnitDraft): string {
  return u.unitType ? `${propertyTypeLabel(u.unitType)} ${u.unitNumber}` : ''
}

/** "Flat 1" already listed in the same building (on a compound, the same one in it). */
function nameTaken(u: UnitDraft): boolean {
  const mine = unitLabel(u).toLowerCase()
  if (!mine) return false
  const compound = site(u) === 'compound'
  return u.existing.some(
    (e) =>
      e.unitLabel.toLowerCase() === mine &&
      (!compound ||
        (e.structure === u.compoundStructure &&
          e.buildingLabel === buildingLetter(u.compoundNumber))),
  )
}

/** Why the unit can't be listed yet, or null. Mirrors the app's step check. */
export function unitProblem(u: UnitDraft): string | null {
  if (!u.creating && !u.buildingId) {
    return 'Pick the building this unit is in, or add a new one.'
  }
  if (u.creating && !u.newName.trim()) return 'Name the building or compound.'
  if (u.creating && !u.newStructure) return 'Say what the whole building is.'
  if (!u.unitType) return 'Say what kind of unit this is.'
  if (site(u) === 'compound' && !u.compoundStructure) {
    return 'Say which building in the compound this unit is in.'
  }
  if (nameTaken(u)) {
    return `"${unitLabel(u)}" is already listed in this building. Use a different unit number.`
  }
  return null
}

export function toUnitInput(u: UnitDraft): UnitInput {
  const compound = site(u) === 'compound'
  return {
    buildingId: u.creating ? null : u.buildingId,
    newBuilding: u.creating ? { name: u.newName.trim(), structure: u.newStructure } : null,
    unitLabel: unitLabel(u),
    floor: u.floor,
    bathroomAccess: u.bathroomAccess,
    toiletAccess: u.toiletAccess,
    kitchenAccess: u.kitchenAccess,
    livingRoomAccess: u.livingRoomAccess,
    // Recorded for every unit so a card can say "in a duplex" without loading
    // the building. On a compound it is the building picked inside it.
    unitBuildingStructure: compound ? u.compoundStructure || null : site(u) || null,
    unitBuildingLabel: compound && u.compoundStructure ? buildingLetter(u.compoundNumber) : null,
  }
}

/**
 * A plain room or room & parlour starts shared, the norm for those rungs;
 * everything else starts private. Defaults only, every answer is editable.
 */
function withTypeDefaults(u: UnitDraft, type: string): UnitDraft {
  const access = type === 'room' || type === 'roomAndParlour' ? 'shared' : 'private'
  return {
    ...u,
    unitType: type,
    bathroomAccess: access,
    toiletAccess: access,
    kitchenAccess: access,
    // A plain room has no parlour of its own.
    livingRoomAccess: type === 'room' ? 'none' : access,
  }
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm"
      style={{
        background: on ? 'var(--primary)' : 'var(--surface-secondary)',
        color: on ? '#fff' : 'var(--text-secondary)',
        border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
      }}
    >
      {label}
    </button>
  )
}

function Label({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-medium text-content">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-content-hint">{hint}</p>}
    </div>
  )
}

const ACCESS_ROWS: Array<[key: 'bathroomAccess' | 'toiletAccess' | 'kitchenAccess' | 'livingRoomAccess', label: string, none: boolean]> = [
  ['bathroomAccess', 'Bathroom', false],
  ['toiletAccess', 'Toilet', false],
  ['kitchenAccess', 'Kitchen', true],
  ['livingRoomAccess', 'Living room', true],
]

export function UnitFields({
  uid,
  value: u,
  onChange,
}: {
  uid: string
  value: UnitDraft
  onChange: (u: UnitDraft) => void
}) {
  const [buildings, setBuildings] = useState<Building[] | null>(null)

  useEffect(() => {
    void myBuildings(uid)
      .then(setBuildings)
      .catch(() => setBuildings([]))
  }, [uid])

  async function pick(b: Building) {
    const next = { ...u, buildingId: b.id, creating: false, siteStructure: b.structure, existing: [] }
    onChange(next)
    onChange({ ...next, existing: await unitsInBuilding(b.id) })
  }

  const isCompound = site(u) === 'compound'
  // Buildings other units in this compound already named, so a second unit in
  // the same duplex is picked, not retyped onto a different letter.
  const compoundBuildings = isCompound
    ? Array.from(
        new Map(
          u.existing
            .filter((e) => e.structure && e.buildingLabel)
            .map((e) => [`${e.structure}|${e.buildingLabel}`, e]),
        ).values(),
      )
    : []
  const nameMismatch =
    u.creating && /compound/i.test(u.newName) && !!u.newStructure && u.newStructure !== 'compound'

  return (
    <div className="space-y-6">
      <div>
        <Label title="Which building is it in?" hint="Pick one you have already listed under, or add it now." />
        <div className="space-y-2">
          {buildings === null && <p className="text-sm text-content-secondary">Loading…</p>}
          {buildings?.map((b) => {
            const on = !u.creating && u.buildingId === b.id
            const verified = b.ownershipDocStatus === 'verified'
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => void pick(b)}
                className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left"
                style={{
                  border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                  background: 'var(--surface)',
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-content">{b.name}</span>
                  {b.structure && (
                    <span className="block text-xs text-content-hint">{structureLabel(b.structure)}</span>
                  )}
                </span>
                <span className={`shrink-0 text-xs ${verified ? 'text-success' : 'text-warning'}`}>
                  {verified ? 'Doc verified' : 'Doc pending'}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => onChange({ ...u, creating: true, buildingId: null, existing: [] })}
            className="w-full rounded-lg p-3 text-left text-sm font-medium"
            style={{
              border: '1px solid ' + (u.creating ? 'var(--primary)' : 'var(--border)'),
              color: u.creating ? 'var(--primary)' : 'var(--text-primary)',
              background: 'var(--surface)',
            }}
          >
            + Create a new building
          </button>
        </div>
        {u.creating && (
          <div className="mt-4 space-y-4">
            {/* Name only: the address is asked once, under Location, and the
                building takes it from there. */}
            <label className="block">
              <span className="text-sm font-medium text-content">Building or compound name</span>
              <input
                className="input-field mt-1.5 px-4 py-3"
                placeholder="e.g. Olu Compound"
                value={u.newName}
                onChange={(e) => onChange({ ...u, newName: e.target.value })}
              />
            </label>
            <div>
              <Label title="What is the whole building?" />
              <div className="flex flex-wrap gap-2">
                {STRUCTURES.map(([v, l]) => (
                  <Chip key={v} on={u.newStructure === v} label={l} onClick={() => onChange({ ...u, newStructure: v })} />
                ))}
              </div>
              {nameMismatch && (
                <p className="mt-2 text-xs text-warning">
                  You named this a compound but picked &quot;{structureLabel(u.newStructure)}&quot;. Pick
                  Compound if it holds more than one building, so you can say which one each unit is in.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <Label
          title="What kind of unit is it?"
          hint="What the tenant actually gets. The type carries the size: a room is one room, a self contain is one space."
        />
        <div className="flex flex-wrap gap-2">
          {UNIT_TYPES.map((t) => (
            <Chip key={t} on={u.unitType === t} label={propertyTypeLabel(t)} onClick={() => onChange(withTypeDefaults(u, t))} />
          ))}
        </div>
      </div>

      {u.unitType && (
        <div>
          <Label
            title="Which one is it?"
            hint={`Only matters when the building has more than one ${propertyTypeLabel(u.unitType).toLowerCase()}. Tenants and our reviewers see this to tell them apart.`}
          />
          <div className="flex items-center gap-3">
            <input
              className="input-field px-4 py-3"
              // .input-field sets width: 100%, which outranks a w- class.
              style={{ width: '6rem' }}
              type="number"
              min={1}
              aria-label="Unit number"
              value={u.unitNumber}
              onChange={(e) => onChange({ ...u, unitNumber: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
            />
            <span className="text-sm text-content-secondary">Listed as &quot;{unitLabel(u)}&quot;</span>
          </div>
          {nameTaken(u) && (
            <p className="mt-2 text-xs text-warning">
              &quot;{unitLabel(u)}&quot; is already listed in this building. Use a different number so
              tenants can tell them apart.
            </p>
          )}
        </div>
      )}

      {/* A compound is land: one C of O can cover a duplex and a bungalow side
          by side, so the unit says which one it is in. */}
      {isCompound && (
        <div>
          <Label
            title="Which building in the compound?"
            hint="A compound can hold a duplex on one side and a bungalow on the other. This says which one this unit is in."
          />
          {compoundBuildings.length > 0 && (
            <>
              <p className="mb-2 text-xs text-content-hint">Already in this compound</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {compoundBuildings.map((b) => (
                  <Chip
                    key={`${b.structure}|${b.buildingLabel}`}
                    on={u.compoundStructure === b.structure && buildingLetter(u.compoundNumber) === b.buildingLabel}
                    label={`${structureLabel(b.structure)} ${b.buildingLabel}`}
                    onClick={() =>
                      onChange({ ...u, compoundStructure: b.structure, compoundNumber: letterNumber(b.buildingLabel) })
                    }
                  />
                ))}
              </div>
              <p className="mb-2 text-xs text-content-hint">Or describe a different one</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {STRUCTURES.filter(([v]) => v !== 'compound').map(([v, l]) => (
              <Chip key={v} on={u.compoundStructure === v} label={l} onClick={() => onChange({ ...u, compoundStructure: v })} />
            ))}
          </div>
          {u.compoundStructure && (
            <div className="mt-3 flex items-center gap-3">
              <input
                className="input-field px-4 py-3"
                style={{ width: '6rem' }}
                type="number"
                min={1}
                max={26}
                aria-label="Which one"
                value={u.compoundNumber}
                onChange={(e) =>
                  onChange({ ...u, compoundNumber: Math.min(26, Math.max(1, Number.parseInt(e.target.value, 10) || 1)) })
                }
              />
              <span className="text-sm text-content-secondary">
                Shown as &quot;{structureLabel(u.compoundStructure)} {buildingLetter(u.compoundNumber)}&quot;
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <Label title="Which floor is it on?" hint="Optional. Tap again to clear." />
        <div className="flex flex-wrap gap-2">
          {FLOORS.map(([v, l]) => (
            <Chip key={v} on={u.floor === v} label={l} onClick={() => onChange({ ...u, floor: u.floor === v ? '' : v })} />
          ))}
        </div>
      </div>

      {u.unitType && (
        <div>
          <Label
            title="What does the tenant share?"
            hint="Other tenants in the building may share these. Tenants filter on it, so say it as it is."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {ACCESS_ROWS.map(([key, label, none]) => (
              <label key={key} className="block">
                <span className="text-sm text-content">{label}</span>
                <select
                  className="input-field mt-1.5 px-4 py-3"
                  value={u[key]}
                  onChange={(e) => onChange({ ...u, [key]: e.target.value })}
                >
                  <option value="private">Their own</option>
                  <option value="shared">Shared</option>
                  {none && <option value="none">None</option>}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
