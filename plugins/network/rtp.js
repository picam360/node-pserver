var dgram = require("dgram");

function PacketHeader(pack) {
	var packetlength = pack.length;
	var payloadtype = pack.readUInt8(1) & 0x7F;
	var sequencenumber = pack.readUInt16BE(2);
	var timestamp = pack.readUInt32BE(4);
	var ssrc = pack.readUInt32BE(8);
	var self = {
		GetSequenceNumber : function() {
			return sequencenumber;
		},
		GetTimestamp : function() {
			return timestamp;
		},
		GetSsrc : function() {
			return ssrc;
		},
		GetPacketData : function() {
			return pack;
		},
		GetPacketLength : function() {
			return packetlength;
		},
		GetHeaderLength : function() {
			return 12;
		},
		GetPayloadType : function() {
			return payloadtype;
		},
		GetPayloadLength : function() {
			return packetlength - self.GetHeaderLength();
		},
		GetPayload : function() {
			return pack.slice(self.GetHeaderLength(), packetlength); //start, end
		}
	};
	return self;
}


function Rtp(conn) {
	var m_conn = conn;
	var m_callback = null;
	var m_sequencenumber = 0;
	
	if(m_conn){
		m_conn.on("data", function(buff) {
			if (m_callback) {
				if (buff.constructor.name != "Buffer") {
					buff = Buffer.from(buff);
				}
				m_callback(PacketHeader(buff));
			}
		});
	}
	
	var self = {
		build_packet: function(data, pt, timestamp_ms) {
			var now = new Date().getTime();
			timestamp_s = Math.floor((timestamp_ms || now) / 1000);
			timestamp_ss = (timestamp_ms || now) / 1000 - timestamp_s;
			var header_len = 12;
			var pack = Buffer.alloc(header_len + data.length);
			pack.writeUInt8(0, 0);
			pack.writeUInt8(pt & 0x7F, 1);
			pack.writeUInt16BE(m_sequencenumber, 2);
			pack.writeUInt32BE(timestamp_s, 4);
			pack.writeUInt32BE(timestamp_ss * 1e6, 8);
			data.copy(pack, header_len);
		
			m_sequencenumber++;
			if (m_sequencenumber >= (1 << 16)) {
				m_sequencenumber = 0;
			}
		
			return pack;
		},
		set_callback : function(callback) {
			m_callback = callback;
		},
		// @_packet : Buffer
		sendpacket: function(packets) {
			if (!m_conn) {
				return;
			}
			if (!Array.isArray(packets)) {
				m_conn.send(packets);
				return;
			}
			for (var i = 0; i < packets.length; i++) {
				m_conn.send(packets[i]);
			}
		},
	};
	return self;
}

exports.PacketHeader = PacketHeader;
exports.PacketHeaderLength = 12;
exports.Rtp = Rtp;
