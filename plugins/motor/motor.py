import sys
from Adafruit_MotorHAT import Adafruit_MotorHAT

driver = Adafruit_MotorHAT(i2c_bus=1)
motor1 = driver.getMotor(1)
motor2 = driver.getMotor(2)
dir_forward = Adafruit_MotorHAT.BACKWARD
dir_backward = Adafruit_MotorHAT.FORWARD
duty = 40
speed = int(duty*255/100)

for line in sys.stdin:
    line = line.strip()
    if line == "init":
        motor1.setSpeed(0)
        motor1.run(dir_forward)
        motor2.setSpeed(0)
        motor2.run(dir_forward)
        print(line + ' done')
    elif line == "move_forward":
        motor1.setSpeed(speed)
        motor1.run(dir_forward)
        motor2.setSpeed(speed)
        motor2.run(dir_forward)
        print(line + ' done')
    elif line == "move_backward":
        motor1.setSpeed(speed)
        motor1.run(dir_backward)
        motor2.setSpeed(speed)
        motor2.run(dir_backward)
        print(line + ' done')
    elif line == "turn_left":
        motor1.setSpeed(speed)
        motor1.run(dir_backward)
        motor2.setSpeed(speed)
        motor2.run(dir_forward)
        print(line + ' done')
    elif line == "turn_right":
        motor1.setSpeed(speed)
        motor1.run(dir_forward)
        motor2.setSpeed(speed)
        motor2.run(dir_backward)
        print(line + ' done')
    elif line == "stop":
        motor1.setSpeed(0)
        motor1.run(dir_forward)
        motor2.setSpeed(0)
        motor2.run(dir_forward)
        print(line + ' done')
    elif line == "exit":
        break
    else:
        print(line)
    sys.stdout.flush()

print('finished')