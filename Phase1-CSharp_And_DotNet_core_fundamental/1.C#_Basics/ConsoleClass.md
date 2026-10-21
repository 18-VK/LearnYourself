# Console Class in C#

This `Console` class provides some methods and properties using which we can implement the user interface in a
console application.

## Properties of Console Class in C#

There are many properties available in the `Console` class. Some of them are as follows:

- **`Title`**: It gets or sets the title to display in the console title bar. It returns the string to be displayed in the
  title bar of the console. The maximum length of the title string is 24500 characters.
- **`BackgroundColor`**: It gets or sets the background color of the console. It returns a value that specifies the
  background color of the console; that is, the color that appears behind each character. The default is black.
- **`ForegroundColor`**: It gets or sets the foreground color of the console. It returns a `ConsoleColor` that specifies the
  foreground color of the console; that is, the color of each character that is displayed. The default is gray.
- **`CursorSize`**: It gets or sets the height of the cursor within a character cell. It returns the size of the cursor
  expressed as a percentage of the height of a character cell. The property value ranges from 1 to 100.

## Methods of Console Class in C#

There are many methods available in the `Console` class. Some of them are as follows:

- **`Clear()`**: It is used to clear the console buffer and corresponding console window of display information. In simple
  words, it is used to clear the screen.
- **`Beep()`**: This method plays the sound of a beep through the console speaker. That means it plays a beep sound using
  a PC speaker at runtime.
- **`ResetColor()`**: This method is used to set the foreground and background console colors to their defaults.
- **`Write("string")`**: This method is used to write the specified string value to the standard output stream.
- **`WriteLine("string")`**: This method is used to write the specified string value, followed by the current line
  terminator, to the standard output stream. That means this method same as the write method but automatically
  moves the cursor to the next line after printing the message.
- **`Write(variable)`**: This method is used to write the value of the given variable to the standard output stream.
- **`WriteLine(variable)`**: This method is used to write the value of the given variable to the standard output stream
  along with moving the cursor to the next line after printing the value of the variable.
- **`Read()`**: This method read a single character from the keyboard and returns its ASCII value. The Datatype should be
  `int` as it returns the ASCII value.
- **`ReadLine()`**: This method reads a string value from the keyboard and returns the entered value only. As it returns
  the entered string value so the DataType is going to be a `string`.
- **`ReadKey()`**: This method reads a single character from the keyboard and returns that character information like what
  key has been entered, and what its corresponding ASCII value is. The Datatype should be `ConsoleKeyInfo` which
  contains the entered key information.
