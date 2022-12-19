import CommonTemplate from "./templates/common.mjs";
import { AttributesFields, DetailsFields, FormulaField, TraitsFields } from "../fields.mjs";

/**
 * System data definition for Vehicles.
 *
 * @property {string} vehicleType                      Type of vehicle as defined in `DND5E.vehicleTypes`.
 * @property {object} attributes
 * @property {string} attributes.ac.motionless         Changes to vehicle AC when not moving.
 * @property {object} attributes.actions               Information on how the vehicle performs actions.
 * @property {boolean} attributes.actions.stations     Does this vehicle rely on action stations that required
 *                                                     individual crewing rather than general crew thresholds?
 * @property {number} attributes.actions.value         Maximum number of actions available with full crewing.
 * @property {object} attributes.actions.thresholds    Crew thresholds needed to perform various actions.
 * @property {number} attributes.actions.thresholds.2  Minimum crew needed to take full action complement.
 * @property {number} attributes.actions.thresholds.1  Minimum crew needed to take reduced action complement.
 * @property {number} attributes.actions.thresholds.0  Minimum crew needed to perform any actions.
 * @property {object} attributes.hp                    Vehicle's hit point data.
 * @property {number} attributes.hp.dt                 Damage threshold.
 * @property {number} attributes.hp.mt                 Mishap threshold.
 * @property {object} attributes.capacity              Information on the vehicle's carrying capacity.
 * @property {string} attributes.capacity.creature     Description of the number of creatures the vehicle can carry.
 * @property {number} attributes.capacity.cargo        Cargo carrying capacity measured in tons.
 * @property {object} traits
 * @property {object} cargo                            Details on this vehicle's crew and cargo capacities.
 * @property {PassengerData[]} cargo.crew              Creatures responsible for operating the vehicle.
 * @property {PassengerData[]} cargo.passengers        Creatures just takin' a ride.
 */
export default class VehicleData extends CommonTemplate {

  static #actorType = "vehicle";

  /* -------------------------------------------- */

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      vehicleType: new foundry.data.fields.StringField({required: true, initial: "water", label: "DND5E.VehicleType"}),
      attributes: new foundry.data.fields.SchemaField({
        ...AttributesFields.attributesFields(),
        ac: new foundry.data.fields.SchemaField({
          flat: new foundry.data.fields.NumberField({integer: true, min: 0, label: "DND5E.ArmorClassFlat"}),
          calc: new foundry.data.fields.StringField({initial: "flat", label: "DND5E.ArmorClassCalculation"}),
          formula: new FormulaField({deterministic: true, label: "DND5E.ArmorClassFormula"}),
          motionless: new foundry.data.fields.StringField({required: true, label: "DND5E.ArmorClassMotionless"})
        }),
        hp: new foundry.data.fields.SchemaField({
          value: new foundry.data.fields.NumberField({
            nullable: true, integer: true, min: 0, initial: null, label: "DND5E.HitPointsCurrent"
          }),
          min: new foundry.data.fields.NumberField({
            nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.HitPointsMin"
          }),
          max: new foundry.data.fields.NumberField({
            nullable: true, integer: true, min: 0, initial: null, label: "DND5E.HitPointsMax"
          }),
          temp: new foundry.data.fields.NumberField({integer: true, initial: 0, min: 0, label: "DND5E.HitPointsTemp"}),
          tempmax: new foundry.data.fields.NumberField({integer: true, initial: 0, label: "DND5E.HitPointsTempMax"}),
          dt: new foundry.data.fields.NumberField({
            required: true, integer: true, min: 0, label: "DND5E.DamageThreshold"
          }),
          mt: new foundry.data.fields.NumberField({
            required: true, integer: true, min: 0, label: "DND5E.VehicleMishapThreshold"
          })
        }, {
          label: "DND5E.HitPoints", validate: d => d.min <= d.max,
          validationError: "HP minimum must be less than HP maximum"
        }),
        action: new foundry.data.fields.SchemaField({
          stations: new foundry.data.fields.BooleanField({required: true, label: "DND5E.VehicleActionStations"}),
          value: new foundry.data.fields.NumberField({
            required: true, nullable: false, integer: true, initial: 0, min: 0, label: "DND5E.VehicleActionMax"
          }),
          thresholds: new foundry.data.fields.SchemaField({
            2: new foundry.data.fields.NumberField({
              required: true, integer: true, min: 0, label: "DND5E.VehicleActionThresholdsFull"
            }),
            1: new foundry.data.fields.NumberField({
              required: true, integer: true, min: 0, label: "DND5E.VehicleActionThresholdsMid"
            }),
            0: new foundry.data.fields.NumberField({
              required: true, integer: true, min: 0, label: "DND5E.VehicleActionThresholdsMin"
            })
          }, {label: "DND5E.VehicleActionThresholds"})
        }, {label: "DND5E.VehicleActions"}),
        capacity: new foundry.data.fields.SchemaField({
          creature: new foundry.data.fields.StringField({required: true, label: "DND5E.VehicleCreatureCapacity"}),
          cargo: new foundry.data.fields.NumberField({
            required: true, nullable: false, integer: true, initial: 0, min: 0, label: "DND5E.VehicleCargoCapacity"
          })
        }, {label: "DND5E.VehicleCargoCrew"})
      }, {label: "DND5E.Attributes"}),
      details: new foundry.data.fields.SchemaField({
        ...DetailsFields.detailsFields()
      }, {label: "DND5E.Details"}),
      traits: new foundry.data.fields.SchemaField({
        ...TraitsFields.traitsFields({size: "lg", di: ["poison", "psychic"], ci: [
          "blinded", "charmed", "deafened", "frightened", "paralyzed", "petrified", "poisoned", "stunned", "unconscious"
        ]}),
        dimensions: new foundry.data.fields.StringField({required: true, label: "DND5E.Dimensions"})
      }, {type: this.#actorType, label: "DND5E.Traits"}),
      cargo: new foundry.data.fields.SchemaField({
        crew: new foundry.data.fields.ArrayField(
          new foundry.data.fields.EmbeddedDataField(PassengerData), {label: "DND5E.VehicleCrew"}
        ),
        passengers: new foundry.data.fields.ArrayField(
          new foundry.data.fields.EmbeddedDataField(PassengerData), {label: "DND5E.VehiclePassengers"}
        )
      }, {label: "DND5E.VehicleCrewPassengers"})
    });
  }
}

/**
 * An embedded data structure representing an entry in the crew or passenger lists.
 * @see VehicleData
 *
 * @property {string} name      Name of individual or type of creature.
 * @property {number} quantity  How many of this creature are onboard?
 */
export class PassengerData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      name: new foundry.data.fields.StringField({required: true, label: "DND5E.VehiclePassengerName"}),
      quantity: new foundry.data.fields.NumberField({
        required: true, nullable: false, integer: true, initial: 0, min: 0, label: "DND5E.VehiclePassengerQuantity"
      })
    };
  }
}
