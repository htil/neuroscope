from spherov2 import scanner
from spherov2.sphero_edu import SpheroEduAPI
from spherov2.types import Color

def main():
    print("Scanning for Sphero BOLT...")
    toy = scanner.find_toy()  # Synchronously find the Sphero BOLT
    if not toy:
        print("No Sphero BOLT found!")
        return

    print("Sphero BOLT found! Connecting...")
    with SpheroEduAPI(toy) as droid:
        print("Connected to Sphero BOLT!")

        # Set LED color to green
        print("Setting LED color to green...")
        droid.set_main_led(Color(r=0, g=255, b=0))

        # Move forward with heading 0, speed 60, for 2 seconds
        print("Moving forward...")
        droid.roll(heading=0, speed=60, duration=2)

        # Set LED color to red after moving
        print("Setting LED color to red...")
        droid.set_main_led(Color(r=255, g=0, b=0))

        print("Done!")

if __name__ == "__main__":
    main()