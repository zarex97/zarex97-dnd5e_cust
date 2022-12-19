/**
 * Data field that selects the appropriate advancement data model if available, otherwise defaults to generic
 * `ObjectField` to prevent issues with custom advancement types that aren't currently loaded.
 */
export class AdvancementField extends foundry.data.fields.ObjectField {

  /**
   * Get the BaseAdvancement definition for the specified advancement type.
   * @param {string} type                    The Advancement type.
   * @returns {typeof BaseAdvancement|null}  The BaseAdvancement class, or null.
   */
  getModelForType(type) {
    return CONFIG.DND5E.advancementTypes[type] ?? null;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cleanType(value, options) {
    if ( !(typeof value === "object") ) value = {};

    const cls = this.getModelForType(value.type);
    if ( cls ) return cls.cleanData(value, options);
    return value;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  initialize(value, model, options={}) {
    const cls = this.getModelForType(value.type);
    if ( cls ) return new cls(value, {parent: model, ...options});
    return foundry.utils.deepClone(value);
  }
}

/* -------------------------------------------- */

/**
 * Data field that automatically selects the Advancement-specific configuration or value data models.
 *
 * @param {Advancement} advancementType  Advancement class to which this field belongs.
 */
export class AdvancementDataField extends foundry.data.fields.ObjectField {
  constructor(advancementType, options={}) {
    super(options);
    this.advancementType = advancementType;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {required: true});
  }

  /**
   * Get the DataModel definition for the specified field as defined in metadata.
   * @returns {typeof DataModel|null}  The DataModel class, or null.
   */
  getModel() {
    return this.advancementType.metadata?.dataModels?.[this.name];
  }

  /* -------------------------------------------- */

  /**
   * Get the defaults object for the specified field as defined in metadata.
   * @returns {object}
   */
  getDefaults() {
    return this.advancementType.metadata?.defaults?.[this.name] ?? {};
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cleanType(value, options) {
    if ( !(typeof value === "object") ) value = {};

    // Use a defined DataModel
    const cls = this.getModel();
    if ( cls ) return cls.cleanData(value, options);
    if ( options.partial ) return value;

    // Use the defined defaults
    const defaults = this.getDefaults();
    return foundry.utils.mergeObject(defaults, value, {inplace: false});
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  initialize(value, model, options={}) {
    const cls = this.getModel();
    if ( cls ) return new cls(value, {parent: model, ...options});
    return foundry.utils.deepClone(value);
  }
}

/* -------------------------------------------- */

/**
 * @typedef {StringFieldOptions} FormulaFieldOptions
 * @property {boolean} [deterministic=false]  Is this formula not allowed to have dice values?
 */

/**
 * Special case StringField which represents a formula.
 *
 * @param {FormulaFieldOptions} [options={}]  Options which configure the behavior of the field.
 * @property {boolean} deterministic=false    Is this formula not allowed to have dice values?
 */
export class FormulaField extends foundry.data.fields.StringField {

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      deterministic: false
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _validateType(value) {
    const roll = new Roll(value);
    if ( this.options.deterministic ) {
      if ( !roll.isDeterministic ) throw new Error("must not contain dice terms");
      Roll.safeEval(roll.formula);
    } else {
      roll.evaluate({async: false});
    }
    super._validateType(value);
  }

}

/* -------------------------------------------- */

/**
 * Special case StringField that includes automatic validation for identifiers.
 */
export class IdentifierField extends foundry.data.fields.StringField {
  /** @override */
  _validateType(value) {
    if ( !dnd5e.utils.validators.isValidIdentifier(value) ) {
      throw new Error(game.i18n.localize("DND5E.IdentifierError"));
    }
  }
}

/* -------------------------------------------- */

/**
 * @typedef {DataFieldOptions} MappingFieldOptions
 * @property {string[]} [initialKeys]  Keys that will be created if no data is provided.
 */

/**
 * A subclass of ObjectField that represents a mapping of keys to the provided DataField type.
 *
 * @param {DataField} type                     The class of DataField which should be embedded in this field.
 * @param {MappingFieldOptions} [options={}]   Options which configure the behavior of the field.
 * @property {string[]} [initialKeys]          Keys that will be created if no data is provided.
 */
export class MappingField extends foundry.data.fields.ObjectField {
  constructor(model, options) {
    if ( !(model instanceof foundry.data.fields.DataField) ) {
      throw new Error("MappingField must have a DataField as its contained element");
    }
    super(options);

    /**
     * The embedded DataField definition which is contained in this field.
     * @type {DataField}
     */
    this.model = model;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      initialKeys: null,
      initialValue: null
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cleanType(value, options) {
    Object.values(value).forEach(v => this.model.clean(v, options));
    return value;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getInitialValue(data) {
    let keys = this.initialKeys;
    const initial = super.getInitialValue(data);
    if ( !keys || !foundry.utils.isEmpty(initial) ) return initial;
    if ( !(keys instanceof Array) ) keys = Object.keys(keys);
    for ( const key of keys ) {
      const modelInitial = this.model.getInitialValue();
      initial[key] = this.initialValue?.(key, modelInitial) ?? modelInitial;
    }
    return initial;
  }

  /* -------------------------------------------- */

  /** @override */
  _validateType(value, options={}) {
    if ( foundry.utils.getType(value) !== "Object" ) throw new Error("must be an Object");
    const errors = this._validateValues(value, options);
    if ( !foundry.utils.isEmpty(errors) ) throw new foundry.data.fields.ModelValidationError(errors);
  }

  /* -------------------------------------------- */

  /**
   * Validate each value of the object.
   * @param {object} value     The object to validate.
   * @param {object} options   Validation options.
   * @returns {Object<Error>}  An object of value-specific errors by key.
   */
  _validateValues(value, options) {
    const errors = {};
    for ( const [k, v] of Object.entries(value) ) {
      const error = this.model.validate(v, options);
      if ( error ) errors[k] = error;
    }
    return errors;
  }

  /* -------------------------------------------- */

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    return Object.entries(value).reduce((obj, [k, v]) => {
      obj[k] = this.model.initialize(v, model, options);
      return obj;
    }, {});
  }
}

/* -------------------------------------------- */

export class AttributesFields {
  static attributesFields() {
    return {
      init: new foundry.data.fields.SchemaField({
        value: new foundry.data.fields.NumberField({
          nullable: false, integer: true, initial: 0, label: "DND5E.Initiative"
        }),
        bonus: new foundry.data.fields.NumberField({
          nullable: false, integer: true, initial: 0, label: "DND5E.InitiativeBonus"
        })
      }, { label: "DND5E.Initiative" }),
      movement: new foundry.data.fields.SchemaField({
        burrow: new foundry.data.fields.NumberField({
          nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.MovementBurrow"
        }),
        climb: new foundry.data.fields.NumberField({
          nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.MovementClimb"
        }),
        fly: new foundry.data.fields.NumberField({
          nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.MovementFly"
        }),
        swim: new foundry.data.fields.NumberField({
          nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.MovementSwim"
        }),
        walk: new foundry.data.fields.NumberField({
          nullable: false, integer: true, min: 0, initial: 30, label: "DND5E.MovementWalk"
        }),
        units: new foundry.data.fields.StringField({initial: "ft", label: "DND5E.MovementUnits"}),
        hover: new foundry.data.fields.BooleanField({label: "DND5E.MovementHover"})
      }, {label: "DND5E.Movement"})
    };
  }

  /* -------------------------------------------- */

  static creatureFields() {
    return {
      attunement: new foundry.data.fields.SchemaField({
        max: new foundry.data.fields.NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 3, label: "DND5E.AttunementMax"
        })
      }, {label: "DND5E.Attunement"}),
      senses: new foundry.data.fields.SchemaField({
        darkvision: new foundry.data.fields.NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.SenseDarkvision"
        }),
        blindsight: new foundry.data.fields.NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.SenseBlindsight"
        }),
        tremorsense: new foundry.data.fields.NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.SenseTremorsense"
        }),
        truesight: new foundry.data.fields.NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.SenseTruesight"
        }),
        units: new foundry.data.fields.StringField({required: true, initial: "ft", label: "DND5E.SenseUnits"}),
        special: new foundry.data.fields.StringField({required: true, label: "DND5E.SenseSpecial"})
      }, {label: "DND5E.Senses"}),
      spellcasting: new foundry.data.fields.StringField({
        required: true, blank: true, initial: "int", label: "DND5E.SpellAbility"
      })
    };
  }
}

/* -------------------------------------------- */

export class DetailsFields {
  static detailsFields() {
    return {
      biography: new foundry.data.fields.SchemaField({
        value: new foundry.data.fields.HTMLField({label: "DND5E.Biography"}),
        public: new foundry.data.fields.HTMLField({label: "DND5E.BiographyPublic"})
      }, {label: "DND5E.Biography"})
    };
  }

  /* -------------------------------------------- */

  static creatureFields() {
    return {
      alignment: new foundry.data.fields.StringField({required: true, label: "DND5E.Alignment"}),
      race: new foundry.data.fields.StringField({required: true, label: "DND5E.Race"})
    };
  }
}

/* -------------------------------------------- */

export class TraitsFields {
  static traitsFields({size="med", di=[], ci=[]}={}) {
    return {
      size: new foundry.data.fields.StringField({
        required: true, initial: size, label: "DND5E.Size"
      }),
      di: makeSimpleTrait({label: "DND5E.DamImm"}, di), // TODO: Add "bypasses" here
      dr: makeSimpleTrait({label: "DND5E.DamRes"}), // TODO: Add "bypasses" here
      dv: makeSimpleTrait({label: "DND5E.DamVuln"}), // TODO: Add "bypasses" here
      ci: makeSimpleTrait({label: "DND5E.ConImm"}, ci)
    };
  }

  /* -------------------------------------------- */

  static creatureFields() {
    return {
      languages: makeSimpleTrait({label: "DND5E.Languages"})
    };
  }

  /* -------------------------------------------- */

  /**
   * Data structure for a standard actor trait.
   *
   * @typedef {object} SimpleTraitData
   * @property {Set<string>} value  Keys for currently selected traits.
   * @property {string} custom      Semicolon-separated list of custom traits.
   */

  /**
   * Produce the schema field for a simple trait.
   * @param {object} [schemaOptions={}]  Options passed to the outer schema.
   * @param {string[]} [initial={}]      The initial value for the value set.
   * @returns {SchemaField}
   */
  static makeSimpleTrait(schemaOptions={}, initial=[]) {
    return new foundry.data.fields.SchemaField({
      value: new foundry.data.fields.SetField(
        new foundry.data.fields.StringField({blank: false}), {label: "DND5E.TraitsChosen", initial}
      ),
      custom: new foundry.data.fields.StringField({required: true, label: "DND5E.Special"})
    }, schemaOptions);
  }
}

/* -------------------------------------------- */



export function makeSimpleTrait(schemaOptions={}, initial=[]) {
  return new foundry.data.fields.SchemaField({
    value: new foundry.data.fields.SetField(
      new foundry.data.fields.StringField({blank: false}), {label: "DND5E.TraitsChosen", initial}
    ),
    custom: new foundry.data.fields.StringField({required: true, label: "DND5E.Special"})
  }, schemaOptions);
}
