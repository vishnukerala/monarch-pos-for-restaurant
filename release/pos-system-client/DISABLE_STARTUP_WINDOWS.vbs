Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
command = """" & root & "\scripts\disable_windows_startup.pyw"" --gui"
shell.Run command, 0, False
