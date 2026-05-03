This is the prompt I gave to Cursor:

> Can you make a basic Firefox extension in here that will add a button/menu/whatever to the toolbar.
> The function of the extension is to capture websocket data.
> And the button in the toolbar needs to allow me to turn it on/off, and to export the captured data. When I "export" it needs to pop up a location select dialog or whatever for me to pick the file I save it to. As .json.
> And I think when we export, clear the in-memory data.
> The purpose is to extract websocket data for like product1.json and then when I save it it gets reset, and then I'll navigate to product2 and then save product2.json, etc.
> I think it needs to work by patching window.WebSocket inside the page context, unsure, what do you propose?
> By default it should be inactive. When I make it active it can tell me I need to refresh the page.
> And maybe the icon in the toolbar should somehow flash or whatever to indicate when it is seeing websocket traffic.
