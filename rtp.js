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
	if(!conn){
		return null;
	}

	var m_bitrate = 0;
	var m_last_packet_time = Date.now();
	
	var m_conn = conn;
	var m_callback = null;
	var m_sequencenumber = 0;
	var m_timestamp = 0;
	var m_src = 0;
	
	m_conn.on("data", function(buff) {
		if (m_callback) {
			if (buff.constructor.name != "Buffer") {
				buff = new Buffer(buff);
			}
			m_callback(PacketHeader(buff));
		}
	});
	
	var self = {
		build_packet: function(data, pt) {
			var header_len = 12;
			var pack = new Buffer(header_len + data.length);
			pack.writeUInt8(0, 0);
			pack.writeUInt8(pt & 0x7F, 1);
			pack.writeUInt16BE(m_sequencenumber, 2);
			pack.writeUInt32BE(m_timestamp, 4);
			pack.writeUInt32BE(m_src, 8);
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
			if (!Array.isArray(packets)) {
				m_conn.send(packets);
				return;
			}
			for (var i = 0; i < packets.length; i++) {
				m_conn.send(packets[i]);
			}
		},
//		build_packet: function (data, pt) {
//			var raw_header_len = 8;
//			var header_len = 12;
//			var pack = new Buffer(raw_header_len + header_len + data.length);
//			pack[0] = 0xFF;
//			pack[1] = 0xE1;
//			pack[2] = (pack.length >> 8) & 0xFF;//network(big) endian
//			pack[3] = (pack.length >> 0) & 0xFF;//network(big) endian
//			pack[4] = 0x72; // r
//			pack[5] = 0x74; // t
//			pack[6] = 0x70; // p
//			pack[7] = 0x00; // \0
//			pack.writeUInt8(0, raw_header_len + 0);
//			pack.writeUInt8(pt & 0x7F, raw_header_len + 1);
//			pack.writeUInt16BE(sequencenumber, raw_header_len + 2);
//			pack.writeUInt32BE(timestamp, raw_header_len + 4);
//			pack.writeUInt32BE(csrc, raw_header_len + 8);
//			data.copy(pack, raw_header_len + header_len);
//		
//			sequencenumber++;
//			if (sequencenumber >= (1 << 16)) {
//				sequencenumber = 0;
//			}
//		
//			return pack;
//		},
	};
	return self;
}

exports.PacketHeader = PacketHeader;
exports.PacketHeaderLength = 12;
exports.Rtp = Rtp;
