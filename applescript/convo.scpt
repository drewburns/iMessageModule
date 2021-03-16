on run {targetBuddyPhone, targetMessage}
activate application "Messages"
   tell application "System Events" to tell process "Messages"
   key code 45 using command down           -- press Command + N to start a new window
   keystroke targetBuddyPhone  -- input the phone number
   key code 36                              -- press Enter to focus on the message area 
   keystroke targetMessage      -- type some message
   key code 36                              -- press Enter to send
end tell
end run