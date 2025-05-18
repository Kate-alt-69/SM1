!macro customInstall
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ServerManagerBot" "$INSTDIR\ServerManagerBot.exe"
  
  ; Create custom pages
  Page custom AutoStartPage
  Page custom BackgroundPage
  
  Function AutoStartPage
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateCheckbox} 10 10 100% 12u "Start with Windows"
    Pop $AutoStartCheckbox
    
    nsDialogs::Show
  FunctionEnd
  
  Function BackgroundPage
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateCheckbox} 10 10 100% 12u "Run in background"
    Pop $BackgroundCheckbox
    
    nsDialogs::Show
  FunctionEnd
!macroend

!macro customUnInstall
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ServerManagerBot"
!macroend
