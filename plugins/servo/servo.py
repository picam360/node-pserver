import sys
import Adafruit_PCA9685
import math

class Params:
    def __init__(self):
        self.i2c_addr = 0x40
        self.freq_hz = 50
        self.min_us = 500
        self.max_us = 2500
        self.out_pin = 11

class Servo:
    def init(self, address=0x40, freq=50, min_us=500, max_us=2500, degrees = 180):
        self.period = 1000000 / freq
        self.degrees = 180
        self.min_duty = self._us2duty(min_us)
        self.max_duty = self._us2duty(max_us)
        self.freq = freq
        self.pca9685 = Adafruit_PCA9685.PCA9685(address, busnum=1)
        self.pca9685.set_pwm_freq(freq)

    def _us2duty(self, value):
        return int(4095 * value / self.period)

    def position(self, index, degrees=None, radians=None, us=None, duty=None):
        span = self.max_duty - self.min_duty
        if degrees is not None:
            duty = self.min_duty + span * degrees / self.degrees
        elif radians is not None:
            duty = self.min_duty + span * radians / math.radians(self.degrees)
        elif us is not None:
            duty = self._us2duty(us)
        elif duty is not None:
            pass
        else:
            return
        duty = min(self.max_duty, max(self.min_duty, int(duty)))
        self.pca9685.set_pwm(index, 0, duty)

    def release(self, index):
        self.pca9685.set_pwm(index, 0, 0)

po = Params()
ser = Servo()
for line in sys.stdin:
    line = line.strip()
    if line == "init":
        ser.init(address=po.i2c_addr, freq=po.freq_hz, 
            min_us=po.min_us, max_us=po.max_us)
        print(line + ' done')
    elif line.startswith("rotate_to_"):
        deg = int(line[len("rotate_to_"):])
        deg = min(max(deg,0),180)
        ser.position(po.out_pin, degrees=deg)
        print(line + ' done')
    else:
        print(line)
    sys.stdout.flush()
print('finished')


