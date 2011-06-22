YUI.add('io-xdr', function(Y) {

   /**
    * Extends the IO base class to provide an alternate, Flash transport, for making
    * cross-domain requests.
    * @module io
    * @submodule io-xdr
    */

   /**
    * @event io:xdrReady
    * @description This event is fired by YUI.io when the specified transport is
    * ready for use.
    * @type Event Custom
    */
    var E_XDR_READY = Y.publish('io:xdrReady', { fireOnce: true }),

   /**
    * @description Map of stored configuration objects when using 
    * Flash as the transport for cross-domain requests.
    *
    * @property _cB
    * @private
    * @static
    * @type object
    */
    _cB = {},

   /**
    * @description Map of transaction simulated readyState values
    * when XDomainRequest is the transport.
    *
    * @property _rS
    * @private
    * @static
    * @type object
    */
    _rS = {},

    // Document reference
    d = Y.config.doc,
    // Window reference
    w = Y.config.win,
	// XDomainRequest cross-origin request detection
    xdr = w && w.XDomainRequest;

   /**
    * @description Method that creates the Flash transport swf.
    *
    * @method _swf
    * @private
    * @static
    * @param {string} uri - location of io.swf.
    * @param {string} yid - YUI instance id.
    * @return void
    */
    function _swf(uri, yid) {
        var o = '<object id="io_swf" type="application/x-shockwave-flash" data="' +
                uri + '" width="0" height="0">' +
                '<param name="movie" value="' + uri + '">' +
                '<param name="FlashVars" value="yid=' + yid + '">' +
                '<param name="allowScriptAccess" value="always">' +
                '</object>',
            c = d.createElement('div');

        d.body.appendChild(c);
        c.innerHTML = o;
    }

   /**
    * @description Sets event handlers for XDomainRequest transactions.
    *
    * @method _evt
    * @private
    * @static
    * @param {object} o - Transaction object generated by _create() in io-base.
    * @param {object} c - configuration object for the transaction.
    * @return void
    */
    function _evt(o, c) {
		var io = this,
			i = o.id,
			p = 'xdrResponse',
			t = 'timeout';

        o.c.onprogress = function() { _rS[i] = 3; };
        o.c.onload = function() {
            _rS[i] = 4;
            io[p](o, c, 'success');
        };
        o.c.onerror = function() {
            _rS[i] = 4;
            io[p](o, c, 'failure');
        };
        if (c.timeout) {
            o.c.ontimeout = function() {
                _rS[i] = 4;
                io[p](o, c, t);
            };
            o.c[t] = c[t];
        }
    }

   /**
    * @description Creates a response object for XDR transactions, for success
    * and failure cases.
    *
    * @method _data
    * @private
    * @static
    * @param {object} o - Transaction object generated by _create() in io-base.
    * @param {boolean} u - Configuration xdr.use.
    * @param {boolean} d - Configuration xdr.dataType.
    *
    * @return object
    */
    function _data(o, u, d) {
		if (u === 'flash') {
			o.c.responseText = decodeURI(o.c.responseText);
		}
		if (d === 'xml') {
			o.c.responseXML = Y.DataType.XML.parse(o.c.responseXML);
		}
			
		return o;
    }

   /**
    * @description Method for intiating an XDR transaction abort.
    *
    * @method _abort
    * @private
    * @static
    * @param {object} o - Transaction object generated by _create() in io-base.
    * @param {object} c - configuration object for the transaction.
	*/
    function _abort(o, c) {
        return o.c.abort(o.id, c);
    }

   /**
    * @description Method for determining if an XDR transaction has completed
    * and all data are received.
    *
    * @method _isInProgress.
    * @private
    * @static
    * @param {object} o - Transaction object generated by _create() in io-base.
    */
    function _isInProgress(o) {
        return xdr ? _rS[o.id] !== 4 : o.c.isInProgress(o.id);
    }

    Y.mix(Y.IO.prototype, {

       /**
        * @description Map of io transports.
        *
        * @property _transport
        * @private
        * @static
        * @type object
        */
        _transport: {},

       /**
        * @description Method for accessing the transport's interface for making a
        * cross-domain transaction.
        *
        * @method xdr
        * @private
        * @static
        * @param {string} uri - qualified path to transaction resource.
        * @param {object} o - Transaction object generated by _create() in io-base.
        * @param {object} c - configuration object for the transaction.
        */
        xdr: function(uri, o, c) {
			var io = this;

			if (c.xdr.use === 'flash') {
				// The configuration object cannot be serialized safely
				// across Flash's ExternalInterface.
				_cB[o.id] = c;
				w.setTimeout(function() {
					if (o.c.send) {
						o.c.send(uri, { id: o.id,
										uid: o.uid,
										method: c.method,
										data: c.data,
										headers: c.headers });
					}
					else {
						io.xdrResponse(o, c, 'transport error');
						delete _cB[o.id];
					}
				}, Y.io.xdr.delay);
			}
			else if (xdr) {
				_evt(o, c);
				o.c.open(c.method || 'GET', uri);
				o.c.send(c.data);
			}
			else {
				o.c.send(uri, o, c);
			}

			return {
				id: o.id,
				abort: function() {
					return o.c ? _abort(o, c) : false;
				},
				isInProgress: function() {
					return o.c ? _isInProgress(o.id) : false;
				},
				conn: io
			};
        },

       /**
        * @description Response controller for cross-domain requests when using the
        * Flash transport or IE8's XDomainRequest object.
        *
        * @method xdrResponse
        * @private
        * @static
        * @param {string} e - Event name
        * @param {object} o - Transaction object generated by _create() in io-base.
        * @param {object} c - configuration object for the transaction.
        * @return object
        */
        xdrResponse: function(e, o, c) {
			c = _cB[o.id] ? _cB[o.id] : c;
            var io = this,
                m = xdr ? _rS : _cB,
                u = c.xdr.use,
                d = c.xdr.dataType;

            switch (e) {
                case 'start':
                    io.start(o, c);
                    break;
               //case 'complete':
					//This case is not used by Flash or XDomainRequest.
                    //io.complete(o, c);
                    //break;
                case 'success':
                    io.success(_data(o, u, d), c);
                    delete m[o.id];
                    break;
                case 'timeout':
                case 'abort':
				case 'transport error':
					o.e = e;
                case 'failure':
                    io.failure(_data(o, u, d), c);
                    delete m[o.id];
                    break;
            }
        },

       /**
        * @description Fires event "io:xdrReady"
        *
        * @method xdrReady
        * @private
        * @static
        * @param {number} id - transaction id
        *
        * @return void
        */
        xdrReady: function(yid, uid) {
			Y.io.xdr.delay = 0;
            Y.fire(E_XDR_READY, yid);
        },

       /**
        * @description Method to initialize the desired transport.
        *
        * @method transport
        * @public
        * @static
        * @param {object} o - object of transport configurations.
        * @return void
        */
        transport: function(o) {
            if (o.id === 'flash') {
				_swf(Y.UA.ie ? o.src + '?d=' + new Date().valueOf().toString() : o.src, Y.id);
			}

			this._transport[o.id] = (o.id === 'flash') ? d.getElementById('io_swf') : o.src;
        }
    });

	Y.io.xdrResponse = function(e, o, c){
		var io = Y.io._map[o.uid];
		io.xdrResponse.apply(io, [e, o, c]);
	};

	Y.io.transport = function(c){
		var io = Y.io._map['io:0'] || new Y.IO();
		io.transport.apply(io, [c]);
	};
   /**
	* @description Delay value to calling the Flash transport, in the
	* event io.swf has not finished loading.  Once the E_XDR_READY
    * event is fired, this value will be set to 0.
	*
	* @property delay
	* @public
	* @static
	* @type number
	*/
	Y.io.xdr = { delay : 100 };



}, '@VERSION@' ,{requires:['io-base','datatype-xml']});
