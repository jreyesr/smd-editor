# SMD Editor

This is a tool to lay out electronic circuits on prototyping boards, for hand soldering. It allows you to plan a
circuit's layout (component placements and connections) before physically soldering them.

The editor looks like this:

![a screenshot of the editor's UI showing a few components connected with solder lines](public/images/ui.png)

## Features

### Boards

The editor currently supports [the SMTPads 50x50 protoboard](https://www.busboard.com/SP1-50x50-G) by BusBoard Prototype
Systems, which has square SMD pads in a 50-mil grid (for finer surface-mount devices, down to SOIC and 0402 passives,
possibly TSSOP with some manual modifications). It also supports the more traditional through-hole pads in a 100-mil
grid, such
as [Adafruit's Universal Proto-board PCBs](https://www.adafruit.com/product/4785), which works fine with DIP packages,
through-hole devices and larger SMD components (though not SOIC and finer pitch):

| ![a photo of a circuit board with a grid of square copper pads](https://www.busboard.com/images/products/BPS-SP1-50x50-G_Top.jpg) | ![a photo of a circuit board with a grid of circular solder pads](https://cdn-shop.adafruit.com/970x728/4785-00.jpg) |
|-----------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|

### Devices

Currently, there are footprints for the following devices:

* SOIC packages, 8-, 14- and 16-pins
* DIP packages, 8-, 14- and 16-pins
* SOT23 package, 3-, 5- and 6-pin variants
* Plus the ability to remove specific pins on SOIC, DIP and SOT23 packages (e.g. for high-voltage packages that may skip a pin for isolation purposes)
* SMD 2-terminal passives (resistors, capacitors, LEDs), 0402, 0603, 0805 and 1206 imperial sizes
* The [SHT40](https://sensirion.com/products/catalog/SHT40) temperature and humidity sensor by Sensirion

Most devices have configurable parameters (e.g. the name of a SOIC device), which are controlled by double-clicking the 
device. This pops up a parameters panel on the top right corner:

![a screenshot of the editor showing the configuration pane for a SOIC device](public/images/paramsPane.png)

### Solder and connectivity

The Solder component allows you to draw solder lines to connect device pins. Solder lines cause all pads and pins that 
touch to become electrically connected.

![a screenshot of the editor showing two solder lines, one already placed and another being drawn](public/images/solder.png)

By toggling the Ratsnest checkbox, you can display lines that connect device pins that are electrically connected. Two 
pins are connected if they share a board pad, or if they are connected via solder lines. This is equivalent to a 
"netlist" in a schematic program.

![a screenshot of the editor with Ratsnets mode activated, displaying pink lines that join device pins that are electrically connected, either directly or via solder lines](public/images/ratsnest.png)

