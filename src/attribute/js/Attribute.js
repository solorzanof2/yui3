    /**
     * Managed Attribute Provider
     * @module attribute
     */

    var O = Y.Object,

        DOT = ".",
        CHANGE = "Change",
        GET = "get",
        SET = "set",
        GETTER = "getter",
        SETTER = "setter",
        VALUE = "value",
        INIT_VALUE = "initValue",
        READ_ONLY = "readOnly",
        WRITE_ONCE = "writeOnce",
        VALIDATOR = "validator",

        EventTarget = Y.Event.Target;

    /**
     * <p>
     * Attribute provides managed attribute support.
     * </p>
     * <p>
     * The class is designed to be augmented onto a host class,
     * and allows the host to support get/set methods for attributes,
     * initial configuration support and attribute change events.
     * </p>
     * <p>Attributes added to the host can:</p>
     * <ul>
     *     <li>Be defined as read-only.</li>
     *     <li>Be defined as write-once.</li>
     *     <li>Be defined with a set function, used to manipulate
     *     values passed to Attribute's set method, before they are stored.</li>
     *     <li>Be defined with a validator function, to validate values before they are stored.</li>
     *     <li>Be defined with a get function, which can be used to manipulate stored values,
     *     before they are returned by Attribute's get method.</li>
     * </ul>
     *
     * <p>See the <a href="#method_addAtt">addAttr</a> method, for details about how to add attributes with
     * a specific configuration</p>
     *
     * @class Attribute
     * @uses Event.Target
     */
    function Attribute() {
        Y.log('Attribute constructor called', 'info', 'attribute');

        EventTarget.call(this, {emitFacade:true});
        this._conf = new Y.State();
    }

    Attribute.prototype = {
        /**
         * <p>
         * Adds an attribute, with the provided configuration to the host object. Intended
         * to be used by the host object to setup it's set of available attributes.
         * </p>
         * <p>
         * The config argument object literal supports the following optional properties:
         * </p>
         * <dl>
         *    <dt>value &#60;Any&#62;</dt>
         *    <dd>The initial value to set on the attribute</dd>
         *    <dt>readOnly &#60;Boolean&#62;</dt>
         *    <dd>Whether or not the attribute is read only. Attributes having readOnly set to true
         *        cannot be set by invoking the set method.</dd>
         *    <dt>writeOnce &#60;Boolean&#62;</dt>
         *    <dd>Whether or not the attribute is "write once". Attributes having writeOnce set to true, 
         *        can only have their values set once, be it through the default configuration, 
         *        constructor configuration arguments, or by invoking set.</dd>
         *    <dt>setter &#60;Function&#62;</dt>
         *    <dd>The setter function to be invoked (within the context of the host object) before 
         *        the attribute is stored by a call to the set method. The value returned by the 
         *        set function will be the finally stored value.</dd>
         *    <dt>getter &#60;Function&#62;</dt>
         *    <dd>The getter function to be invoked (within the context of the host object) before
         *    the stored values is returned to a user invoking the get method for the attribute.
         *    The value returned by the get function is the final value which will be returned to the 
         *    user when they invoke get.</dd>
         *    <dt>validator &#60;Function&#62;</dt>
         *    <dd>The validator function which is invoked prior to setting the stored value. Returning
         *    false from the validator function will prevent the value from being stored</dd>
         * </dl>
         *
         * @method addAttr
         *
         * @param {String} name The attribute key
         * @param {Object} config (optional) An object literal specifying the configuration for the attribute.
         * <strong>NOTE:</strong> The config object is modified when adding an attribute, 
         * so if you need to protect the original values, you will need to merge or clone the object.
         *
         * @chainable
         */
        addAttr: function(name, config) {
            Y.log('Adding attribute: ' + name, 'info', 'attribute');

            config = config || {};

            var value,
                hasValue = (VALUE in config);

            if (config[READ_ONLY] && !hasValue) { Y.log('readOnly attribute: ' + name + ', added without an initial value. Value will be set on intial call to set', 'warn', 'attribute');}

            if(hasValue) {
                // We'll go through set, don't want to set value in _conf directory
                value = config.value;
                delete config.value;
            }

            config._init = true;
            this._conf.add(name, config);

            if (hasValue) {
                // Go through set, so that raw values get normalized/validated
                this.set(name, value);
            }

            return this;
        },

        /**
         * Removes an attribute.
         *
         * @method removeAttr
         * @param {String} name The attribute key
         */
        removeAttr: function(name) {
            this._conf.remove(name);
        },

        /**
         * Returns the current value of the attribute. If the attribute
         * has been configured with a 'get' handler, this method will delegate
         * to the 'get' handler to obtain the value of the attribute.
         * The 'get' handler will be passed the current value of the attribute 
         * as the only argument.
         *
         * @method get
         *
         * @param {String} key The attribute whose value will be returned. If
         * the value of the attribute is an Object, dot notation can be used to
         * obtain the value of a property of the object (e.g. <code>get("x.y.z")</code>)
         * 
         * @return {Any} The current value of the attribute
         */
        get : function(name) {

            var conf = this._conf,
                path,
                getFn,
                val;

            if (name.indexOf(DOT) !== -1) {
                path = name.split(DOT);
                name = path.shift();
            }

            val = conf.get(name, VALUE);
            getFn = conf.get(name, GETTER) || conf.get(name, GET);

            val = (getFn) ? getFn.call(this, val) : val;
            val = (path) ? this._getSubAttrVal(path, val) : val;

            return val;
        },

        /**
         * Sets the value of an attribute.
         *
         * @method set
         * @chainable
         *
         * @param {String} name The name of the attribute. Note, if the 
         * value of the attribute is an Object, dot notation can be used
         * to set the value of a property within the object (e.g. <code>set("x.y.z", 5)</code>).
         *
         * @param {Any} value The value to apply to the attribute
         *
         * @param {Object} opts Optional event data. This object will be mixed into
         * the event facade passed as the first argument to subscribers 
         * of attribute change events
         *
         * @return {Object} Reference to the host object
         */
        set : function(name, val, opts) {
            return this._setAttr(name, val, opts);
        },

        /**
         * Resets the given attribute or all attributes to the initial value.
         *
         * @method reset
         * @param {String} name optional An attribute to reset.  If omitted, all attributes are reset.
         * @chainable
         */
        reset : function(name) {
            if (name) {
                this._set(name, this._conf.get(name, INIT_VALUE));
            } else {
                var initVals = this._conf.data.initValue;
                Y.each(initVals, function(v, n) {
                    this._set(n, v);
                }, this);
            }
            return this;
        },

        /**
         * Allows setting of readOnly/writeOnce attributes.
         *
         * @method _set
         * @protected
         * @chainable
         *
         * @return {Object} Reference to the host object
         */
        _set : function(name, val, opts) {
            return this._setAttr(name, val, opts, true);
        },

        /**
         * Internal set implementation
         *
         * @method _setAttr
         * @protected
         * @chainable
         *
         * @param {String} name The name of the attribute. Note, if the 
         * value of the attribute is an Object, dot notation can be used
         * to set the value of a property within the object 
         * (e.g. <code>set("x.y.z", 5)</code>), if the attribute has not
         * been declared as an immutable attribute (see <a href="#property_CLONE">Attribute.CLONE</a>).
         *
         * @param {Any} value The value to apply to the attribute
         * 
         * @param {Object} opts Optional event data. This object will be mixed into
         * the event facade passed as the first argument to subscribers 
         * of attribute change events
         *
         * @param {boolean} force If true, allows the caller to set values for 
         * readOnly or writeOnce attributes which have already been set.
         *
         * @return {Object} Reference to the host object
         */
        _setAttr : function(name, val, opts, force) {
            var conf = this._conf,
                data = conf.data,
                allowSet = true,
                initialSet = (!data.value || !(name in data.value)),
                strPath,
                path,
                currVal;

            if (name.indexOf(DOT) !== -1) {
                strPath = name;
                path = name.split(DOT);
                name = path.shift();
            }

            if (!initialSet && !force) {
                if (conf.get(name, WRITE_ONCE)) {
                    Y.log('set ' + name + ' failed; Attribute is writeOnce', 'info', 'attribute');
                    allowSet = false;
                }
                if (conf.get(name, READ_ONLY)) {
                    Y.log('set ' + name + ' failed; Attribute is readOnly', 'info', 'attribute');
                    allowSet = false;
                }
            }
            if (!conf.get(name)) {
                Y.log('set ' + name + ' failed; Attribute is not configured', 'info', 'attribute');
                allowSet = false;
            }

            currVal = this.get(name);

            if (path) {
               val = this._setSubAttrVal(path, Y.clone(currVal), val);

               if (val === undefined) {
                   Y.log('set ' + strPath + 'failed; attribute sub path is invalid', 'error', 'attribute');
                   allowSet = false;
               }
            }

            if (allowSet) {
                this._fireAttrChange(name, currVal, val, name, strPath, opts);
            }

            return this;
        },

        /**
         * Utility method to help setup the event payload and 
         * fire the attribute change event.
         * 
         * @method _fireAttrChange
         * @private
         * @param {String} type The event name
         * @param {Any} currVal The current value of the attribute
         * @param {Any} newVal The new value of the attribute
         * @param {String} attrName The name of the attribute
         * @param {String} strFullPath The full path of the property being changed, 
         * if this is a sub-attribute value being change
         * @param {Object} opts Any additional event data to mix into the attribute change event's event facade.
         */
        _fireAttrChange : function(type, currVal, newVal, attrName, strFullPath, opts) {
            type = type + CHANGE;

            // TODO: Publishing temporarily, while we address event bubbling/queuing
            this.publish(type, {queuable:false, defaultFn:this._defAttrSet, silent:true});

            var eData = {
                type: type,
                prevVal: currVal,
                newVal: newVal,
                attrName: attrName,
                subAttrName: strFullPath
            };

            if (opts) {
                Y.mix(eData, opts);
            }

            this.fire(eData);
        },

        /**
         * Default handler implementation for set events
         *
         * @private
         * @method _defAttrSet
         * @param {Event.Facade} e The event object for the custom event
         */
        _defAttrSet : function(e) {
            var conf = this._conf,
                name = e.attrName,
                val = e.newVal,
                valFn  = conf.get(name, VALIDATOR),
                setFn = conf.get(name, SETTER) || conf.get(name, SET),
                storedVal,
                retVal;

            if (!valFn || valFn.call(this, val)) {

                if (setFn) {
                    retVal = setFn.call(this, val);
                    if (retVal !== undefined) {
                        Y.log('attribute: ' + name + ' modified by setter', 'info', 'attribute');
                        val = retVal; // setter can change value
                    }
                }
                // Store value
                storedVal = { value: val };
                if (conf.get(name, INIT_VALUE) === undefined) {
                    storedVal[INIT_VALUE] = val;
                }
                conf.add(name, storedVal);

                // Honor set normalization
                e.newVal = conf.get(name, VALUE);
            } else {
                Y.log('Validation failed. State not updated and stopImmediatePropagation called for attribute: ' + name + ' , value:' + val, 'warn', 'attribute');

                // Prevent "after" listeners from being 
                // invoked since nothing changed.
                e.stopImmediatePropagation();
            }
        },

        /**
         * Retrieves the sub value at the provided path,
         * from the value object provided.
         *
         * @method _getSubAttrVal
         * @private
         *
         * @param {Array} path  A path array, specifying the object traversal path
         *                      from which to obtain the sub value.
         * @param {Object} val  The object from which to extract the property value
         * @return {Any} The value stored in the path or undefined if not found.
         */
        _getSubAttrVal : function (path, val) {
            var pl = path.length,
                i;

            if (pl > 0) {
                for (i = 0; val !== undefined && i < pl; ++i) {
                    val = val[path[i]];
                }
            }

            return val;
        },

        /**
         * Sets the sub value at the provided path on the value object.
         * Returns the modified value object, or undefined if the path is invalid.
         *
         * 
         *
         * @method _setSubAttrVal
         * @private
         * 
         * @param {Array} path  A path array, specifying the object traversal path
         *                      at which to set the sub value.
         * @param {Object} val  The object on which to set the sub value.
         * @param {Any} subval  The sub value to set.
         * @return {Object}     The modified object, with the new sub value set, or 
         *                      undefined, if the path was invalid.
         */
        _setSubAttrVal : function(path, val, subval) {

            var leafIdx = path.length-1,
                i,
                o;

            if (leafIdx >= 0) {
                o = val;

                for (i = 0; o !== undefined && i < leafIdx; ++i) {
                    o = o[path[i]];
                }

                if (o !== undefined) {
                    o[path[i]] = subval;
                } else {
                    val = undefined;
                }
            }

            return val;
        },

        /**
         * Sets multiple attribute values.
         *
         * @method setAttrs
         * @param {Object} attrs  A hash of attributes: name/value pairs
         * @chainable
         */
        setAttrs : function(attrs) {
            for (var attr in attrs) {
                if ( attrs.hasOwnProperty(attr) ) {
                    this.set(attr, attrs[attr]);
                }
            }
            return this;
        },

        /**
         * Gets multiple attribute values.
         *
         * @method getAttrs
         * @param {Array | Boolean} attrs Optional. An array of attribute names, whose values are required. If omitted, all attribute values are
         * returned. If set to true, all attributes modified from their original values are returned.
         * @return {Object} A hash of attributes: name/value pairs
         */
        getAttrs : function(attrs) {
            var o = {}, i, l, attr, val,
                modifiedOnly = (attrs === true);

            attrs = (attrs && !modifiedOnly) ? attrs : O.keys(this._conf.data[VALUE]);

            for (i = 0, l = attrs.length; i < l; i++) {
                // Go through get, to honor cloning/normalization
                attr = attrs[i];
                val = this.get(attr);

                if (!modifiedOnly || this._conf.get(attr, VALUE) != this._conf.get(attr, INIT_VALUE)) {
                    o[attr] = this.get(attr); 
                }
            }

            return o;
        },

        /**
         * Configures attributes, and sets initial values
         *
         * @method _initAttrs
         * @protected
         * @chainable
         *
         * @param {Object} cfgs Name/value hash of attribute configuration literals.
         * @param {Object} values Name/value hash of initial values to apply. Values defined in the configuration hash will be over-written by the initial values hash unless read-only.
         */
        _initAttrs : function(cfgs, values) {
            if (cfgs) {
                var attr,
                    attrCfg,
                    value;

                values = this._splitAttrVals(values);

                for (attr in cfgs) {
                    if (cfgs.hasOwnProperty(attr)) {

                        // Not Merging. Caller is responsible for isolating configs
                        attrCfg = cfgs[attr];

                        // Handle simple, complex and user values, accounting for read-only
                        value = this._getAttrInitVal(attr, attrCfg, values);

                        if (value !== undefined) {
                            attrCfg.value = value;
                        }

                        this.addAttr(attr, attrCfg);
                    }
                }
            }
            return this;
        },

        /**
         * Utility to split out regular attribute values
         * from complex attribute values, so that complex
         * attributes can be keyed by top level attribute name.
         *
         * @method _splitAttrValues
         * @param {Object} valueHash Name/value hash of initial values
         *
         * @return {Object} Object literal with 2 properties - "simple" and "complex",
         * containing simple and complex attribute values respectively keyed 
         * by attribute the top level attribute name.
         * @private
         */
        _splitAttrVals : function(valueHash) {
            var vals = {},
                subvals = {},
                path,
                attr,
                v, k;

            for (k in valueHash) {
                if (valueHash.hasOwnProperty(k)) {
                    if (k.indexOf(DOT) !== -1) {
                        path = k.split(DOT);
                        attr = path.shift();
                        v = subvals[attr] = subvals[attr] || [];
                        v[v.length] = {
                            path : path, 
                            value: valueHash[k]
                        };
                    } else {
                        vals[k] = valueHash[k];
                    }
                }
            }
            return { simple:vals, complex:subvals };
        },

        /**
         * Returns the initial value of the given attribute from
         * either the default configuration provided, or the 
         * over-ridden value if it exists in the initValues 
         * hash provided, if the attribute is not read-only.
         *
         * @param {String} attr Attribute name
         * @param {Object} cfg Default attribute configuration object literal
         * @param {Object} initValues Name/Value hash of initial attribute values from _splitAttrVals
         *
         * @return {Any} Initial value of the attribute.
         *
         * @method _getAttrInitVal
         * @private
         */
        _getAttrInitVal : function(attr, cfg, initValues) {

            var val = (cfg.valueFn) ? cfg.valueFn.call(this) : cfg.value,
                simple,
                complex,
                i,
                l,
                path,
                subval,
                subvals;

            if (!cfg[READ_ONLY] && initValues) {

                // Simple Attributes
                simple = initValues.simple;
                if (simple && simple.hasOwnProperty(attr)) {
                    val = simple[attr];
                }

                // Complex Attributes (complex values applied, after simple, incase both are set)
                complex = initValues.complex;
                if (complex && complex.hasOwnProperty(attr)) {
                    subvals = complex[attr];
                    for (i = 0, l = subvals.length; i < l; ++i) {
                        path = subvals[i].path;
                        subval = subvals[i].value;
                        this._setSubAttrVal(path, val, subval);
                    }
                }
            }

            return val;
        }
    };

    // Basic prototype augment - no lazy constructor invocation.
    Y.mix(Attribute, EventTarget, false, null, 1);

    Y.Attribute = Attribute;
