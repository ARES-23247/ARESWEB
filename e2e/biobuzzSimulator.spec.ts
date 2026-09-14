import { expect,test } from "./fixtures";
import { mkdir } from "node:fs/promises";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

test("BIOBUZZ configures rear mechanisms and places through the flower top",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  const form=page.getByRole("region",{name:"Robot configuration",exact:true});
  await form.getByLabel("Hive shooter side",{exact:true}).selectOption("back");
  await form.getByLabel("Flower placement side",{exact:true}).selectOption("back");
  await form.getByLabel("Intake side",{exact:true}).selectOption("both");
  await form.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  await expect(page.getByTestId("robot-setup")).toHaveText("Shooter: back · Flower placement: back · Intake: both");
  await page.getByRole("button",{name:"Place in flower",exact:true}).click();
  await expect(page.getByText("Flower 2: 5 pollen / 0 nectar",{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 4 balls",{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByTestId("inventory")).toContainText("2/4");
  await mkdir("scratch/biobuzz",{recursive:true});
  await page.screenshot({path:`scratch/biobuzz/robot-config-${testInfo.project.name}.png`,fullPage:true});
  await page.reload();
  await expect(page.getByTestId("robot-setup")).toContainText("Shooter: back · Flower placement: back · Intake: both");
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await expect(editor.getByLabel("Hive shooter side",{exact:true})).toHaveValue("back");
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await expect(editor.getByRole("status")).toContainText("front-facing mechanisms");
});

test("BIOBUZZ standard gamepad drives, toggles, shoots, places, switches view and disconnects",async({page})=>{
  // Simulate only the browser hardware API; the real worker, controls and physics run unchanged.
  await page.addInitScript(()=>{
    const pad={id:"BIOBUZZ virtual standard controller",mapping:"standard",connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
    Object.defineProperty(navigator,"getGamepads",{value:()=>[pad]});
    Object.assign(window,{BIOBUZZ_TEST_PAD:pad});
  });
  type Pad={connected:boolean;axes:number[];buttons:{pressed:boolean;value:number}[]};
  const button=async(index:number,pressed:boolean)=>page.evaluate(({index,pressed})=>{const p=(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD;p.buttons[index].pressed=pressed;p.buttons[index].value=pressed?1:0;},{index,pressed});
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("gamepad-status")).toContainText("Gamepad connected: BIOBUZZ virtual");
  const before=await page.getByTestId("robot-position").innerText();
  await page.evaluate(()=>{(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD.axes[1]=-.7;});
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await page.evaluate(()=>{(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD.axes[1]=0;});
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();
  const intake=page.getByRole("checkbox",{name:"Run intake",exact:true});
  await button(0,true);await expect(intake).toBeChecked();
  await page.waitForTimeout(150);await expect(intake).toBeChecked();await button(0,false);
  await button(7,true);await expect(page.getByTestId("inventory")).toContainText("3/4",{timeout:10000});
  await page.waitForTimeout(150);await expect(page.getByTestId("inventory")).toContainText("3/4");await button(7,false);
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();
  await button(2,true);await expect(page.getByText("Flower 2: 5 pollen / 0 nectar",{exact:true})).toBeVisible({timeout:10000});await button(2,false);
  await button(8,true);await expect(page.getByRole("button",{name:"Blue driver view",exact:true})).toHaveAttribute("aria-pressed","true");await button(8,false);
  await button(0,true);await expect(intake).toBeChecked();await button(0,false);
  await page.evaluate(()=>{(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD.connected=false;});
  await expect(page.getByTestId("gamepad-status")).toContainText("connect a controller");await expect(intake).not.toBeChecked();
});

test("BIOBUZZ driver views rotate controls and preserve auto coordinates",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  const pose=async()=>{const text=await page.getByTestId("robot-position").innerText();return [...text.matchAll(/-?\d+\.\d+/g)].map(m=>Number(m[0]));};
  const red=page.getByRole("button",{name:"Red driver view",exact:true}),blue=page.getByRole("button",{name:"Blue driver view",exact:true});
  await expect(red).toHaveAttribute("aria-pressed","true");
  const start=await pose();
  await page.locator("canvas.bio-field").click();await page.keyboard.down("w");
  try{await expect.poll(async()=>(await pose())[1]).toBeLessThan(start[1]-.15);}finally{await page.keyboard.up("w");}
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  // Pause and snapshots cross the worker boundary; wait for in-flight poses before
  // checking that a presentation-only view switch leaves the simulation untouched.
  await expect.poll(async()=>{const a=await pose();await page.waitForTimeout(100);return JSON.stringify(a)===JSON.stringify(await pose());}).toBe(true);
  const afterRed=await pose();
  expect(Math.abs(afterRed[0]-start[0])).toBeLessThan(.03);
  await blue.click();await expect(blue).toHaveAttribute("aria-pressed","true");
  expect(await pose()).toEqual(afterRed);
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  await page.locator("canvas.bio-field").click();await page.keyboard.down("w");
  try{await expect.poll(async()=>(await pose())[1]).toBeGreaterThan(afterRed[1]+.1);}finally{await page.keyboard.up("w");}
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const field=page.locator("canvas.bio-field"),editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await field.scrollIntoViewIfNeeded();
  const box=(await field.boundingBox())!;
  await field.click({position:{x:box.width*.75,y:box.height*.25}});
  expect(Number(await editor.getByLabel("X (m)",{exact:true}).nth(1).inputValue())).toBeCloseTo(.9144,1);
  expect(Number(await editor.getByLabel("Y (m)",{exact:true}).nth(1).inputValue())).toBeCloseTo(.9144,1);
  await red.click();
  await field.click({position:{x:box.width*.75,y:box.height*.25}});
  expect(Number(await editor.getByLabel("X (m)",{exact:true}).nth(2).inputValue())).toBeCloseTo(-.9144,1);
  expect(Number(await editor.getByLabel("Y (m)",{exact:true}).nth(2).inputValue())).toBeCloseTo(-.9144,1);
  await mkdir("scratch/biobuzz",{recursive:true});
  await field.screenshot({path:`scratch/biobuzz/red-driver-view-${testInfo.project.name}.png`});
  await blue.click();await field.screenshot({path:`scratch/biobuzz/blue-driver-view-${testInfo.project.name}.png`});
});

test("BIOBUZZ one-press assisted shots and persistent intake toggle",async({page})=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await expect(page.getByRole("checkbox",{name:"Aim hive shots automatically",exact:true})).toBeChecked();
  const intake=page.getByRole("checkbox",{name:"Run intake",exact:true});
  const field=page.locator("canvas.bio-field");
  await field.click();
  await page.keyboard.down("j");await page.keyboard.down("j");await page.keyboard.up("j");
  await expect(intake).toBeChecked();
  const before=await page.getByTestId("robot-position").innerText();
  // A click must keep aiming after the trigger is released, then fire once.
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 4 balls",{exact:true})).toBeVisible();
  await expect(intake).toBeChecked();
  for(const count of [2,1,0]){
    await page.getByRole("button",{name:"Shoot",exact:true}).click();
    await expect(page.getByTestId("inventory")).toContainText(`${count}/4`);
  }
  await expect(page.getByText(/^red hive: 1 tips/)).toBeVisible();
  await expect(intake).toBeChecked();
  await field.click();await page.keyboard.press("j");await expect(intake).not.toBeChecked();
  await page.getByRole("button",{name:"Intake off",exact:true}).click();await expect(intake).toBeChecked();
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();await expect(intake).not.toBeChecked();
});

test("BIOBUZZ solo driving, native auto export, and an actual hive tip",async({page},testInfo)=>{
  test.setTimeout(60000);
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await expect(page.getByRole("combobox",{name:"Controlled robot",exact:true}).locator("option")).toHaveCount(1);
  const before=await page.getByTestId("robot-position").innerText();
  await page.getByRole("button",{name:"Drive right",exact:true}).click();
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await editor.getByLabel("Auto name",{exact:true}).fill("Browser hive auto");
  await editor.getByRole("button",{name:"Add waypoint",exact:true}).click();
  await editor.getByLabel("X (m)",{exact:true}).nth(1).fill("-1.42");
  await editor.getByLabel("Y (m)",{exact:true}).nth(1).fill("1.42");
  await editor.getByLabel("Heading (rad)",{exact:true}).nth(1).fill("-0.8188");
  await editor.getByRole("button",{name:"Add wait",exact:true}).click();
  await editor.getByRole("button",{name:"Add intake",exact:true}).click();
  await editor.getByRole("checkbox",{name:"Intake enabled",exact:true}).uncheck();
  await editor.getByRole("button",{name:"Add shot",exact:true}).click();
  await editor.getByLabel("Balls",{exact:true}).fill("4");
  await editor.getByLabel("Launch speed (m/s)",{exact:true}).fill("5.54");
  await editor.getByRole("button",{name:"Add waypoint",exact:true}).click();
  await editor.getByLabel("X (m)",{exact:true}).nth(2).fill("-0.59417");
  await editor.getByLabel("Y (m)",{exact:true}).nth(2).fill("1.33");
  await editor.getByLabel("Heading (rad)",{exact:true}).nth(2).fill("1.5708");
  await editor.getByRole("button",{name:"Add intake",exact:true}).click();
  await editor.getByRole("button",{name:"Add wait",exact:true}).click();
  await editor.getByLabel("Seconds",{exact:true}).nth(1).fill("2");
  await editor.getByRole("button",{name:"Save locally",exact:true}).click();
  const downloaded=page.waitForEvent("download");
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await mkdir("scratch/biobuzz",{recursive:true});
  const destination=`scratch/biobuzz/browser-auto-${testInfo.project.name}.zip`;
  await (await downloaded).saveAs(destination);
  const zip=await JSZip.loadAsync(await readFile(destination));
  const catalog=JSON.parse(await zip.file(".ares/autonomous-catalog.json")!.async("string"));
  expect(catalog.entries[0]).toMatchObject({authoredAlliance:"RED",mirrorForOppositeAlliance:false,startingPose:{xMeters:-1.1,yMeters:1.8288-Math.hypot(0.225,0.225)}});
  await editor.getByRole("button",{name:"Preview auto",exact:true}).click();
  await expect(page.getByTestId("match-clock")).toContainText("AUTO");
  await expect(page.getByText(/^red hive: 1 tips/)).toBeVisible({timeout:15000});
  await expect(page.getByTestId("inventory")).toContainText("4/4",{timeout:20000});
  await expect(page.getByText("Flower 2: 0 pollen / 0 nectar",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close auto editor",exact:true}).click();
  await page.screenshot({path:`scratch/biobuzz/browser-hive-tip-${testInfo.project.name}.png`,fullPage:true});
  await page.getByRole("button",{name:"Solo, no bots",exact:true}).click();
  await expect(page.getByTestId("match-clock")).toContainText("PRACTICE");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
});
