import { expect,test } from "./fixtures";
import { mkdir } from "node:fs/promises";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

test("BIOBUZZ saves intake ball types for the robot and browser autos",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("robot-intake")).toHaveText("Intake collects: Pollen and nectar");
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  const form=page.getByRole("region",{name:"Robot configuration",exact:true});
  await expect(form.getByLabel("Intake ball types",{exact:true})).toHaveValue("both");
  await form.getByLabel("Intake ball types",{exact:true}).selectOption("pollen");
  await mkdir("scratch/biobuzz",{recursive:true});
  await form.screenshot({path:`scratch/biobuzz/intake-filter-${testInfo.project.name}.png`});
  await form.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  await expect(page.getByTestId("robot-intake")).toHaveText("Intake collects: Pollen only");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await page.reload();
  await expect(page.getByTestId("robot-intake")).toHaveText("Intake collects: Pollen only");
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await expect(editor.getByLabel("Intake ball types",{exact:true})).toHaveValue("pollen");
  await editor.getByRole("button",{name:"Save locally",exact:true}).click();
  await editor.getByLabel("Intake ball types",{exact:true}).selectOption("both");
  await editor.getByRole("button",{name:"Load saved",exact:true}).click();
  await expect(editor.getByLabel("Intake ball types",{exact:true})).toHaveValue("pollen");
  await editor.getByRole("button",{name:"Preview auto",exact:true}).click();
  await expect(page.getByTestId("robot-intake")).toHaveText("Intake collects: Pollen only");
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await expect(editor.getByRole("status")).toContainText("reference intake collects pollen and nectar");
  await editor.getByLabel("Intake ball types",{exact:true}).selectOption("both");
  await editor.getByRole("button",{name:"Preview auto",exact:true}).click();
  await expect(page.getByTestId("robot-intake")).toHaveText("Intake collects: Pollen and nectar");
});

test("BIOBUZZ configures rear mechanisms and places through the flower top",async({page},testInfo)=>{
  test.setTimeout(60000);
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await expect(page.getByTestId("flower-contents-2").getByLabel("4 pollen",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  const form=page.getByRole("region",{name:"Robot configuration",exact:true});
  await form.getByLabel("Hive shooter side",{exact:true}).selectOption("back");
  await form.getByLabel("Flower placement side",{exact:true}).selectOption("back");
  await form.getByLabel("Intake side",{exact:true}).selectOption("both");
  await form.getByLabel("Turn speed (degrees/s)",{exact:true}).fill("30");
  await form.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  await expect(page.getByTestId("robot-setup")).toHaveText("Shooter: back · Flower placement: back · Intake: both");
  await page.getByRole("button",{name:"Place in flower",exact:true}).click();
  await expect(page.getByText("Flower 2: 5 pollen / 0 nectar",{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByTestId("flower-contents-2").getByLabel("5 pollen",{exact:true})).toBeVisible();
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await page.getByRole("button",{name:"Aim",exact:true}).click();
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot",{timeout:20000});
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 4 balls",{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByTestId("hive-contents-red-1").getByLabel("1 pollen",{exact:true})).toBeVisible();
  await expect(page.getByTestId("hive-contents-red-1").getByLabel("3 red nectar",{exact:true})).toBeVisible();
  await expect(page.getByTestId("inventory")).toContainText("2/4");
  await mkdir("scratch/biobuzz",{recursive:true});
  await page.screenshot({path:`scratch/biobuzz/robot-config-${testInfo.project.name}.png`,fullPage:true});
  const fieldWrap=page.locator(".bio-field-wrap");
  await fieldWrap.screenshot({path:`scratch/biobuzz/element-counts-${testInfo.project.name}.png`});
  for(const view of ["Blue driver view","Red driver view"]){
    await page.getByRole("button",{name:view,exact:true}).click();
    const bounds=(await fieldWrap.boundingBox())!,labels=page.locator(".bio-element-label");
    await expect(labels).toHaveCount(8);
    const boxes=await Promise.all(Array.from({length:8},(_,i)=>labels.nth(i).boundingBox()));
    for(const box of boxes){expect(box).not.toBeNull();const b=box!;expect(b.x>=bounds.x+bounds.width||b.y>=bounds.y+bounds.height||b.x+b.width<=bounds.x||b.y+b.height<=bounds.y).toBe(true);}
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i]!,b=boxes[j]!;
      expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
    }
  }
  await page.reload();
  await expect(page.getByTestId("robot-setup")).toContainText("Shooter: back · Flower placement: back · Intake: both");
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await expect(editor.getByLabel("Hive shooter side",{exact:true})).toHaveValue("back");
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await expect(editor.getByRole("status")).toContainText("front-facing mechanisms");
});

test("BIOBUZZ keeps counts outside the full field in short, narrow and banner layouts",async({page},testInfo)=>{
  test.setTimeout(60000);
  await page.route("**/api/announcements",route=>route.fulfill({json:{announcement:{
    message:"No Practice tonight. Building field for tomorrow and students can't sign the NDA. Launch tomorrow at SPARK. Arrive at 9:30 AM",
    severity:"important",link:null,linkLabel:null,revision:"biobuzz-layout-test",startsAt:null,endsAt:null,
  }}}));
  for(const size of [{width:820,height:912},{width:1366,height:768},{width:390,height:844},{width:667,height:375}]){
    await page.setViewportSize(size);await page.goto("/biobuzz/simulator");
    await expect(page.getByLabel("Team announcement",{exact:true})).toBeVisible();
    await expect(page.getByTestId("inventory")).toContainText("4/4");
    const field=page.locator("canvas.bio-field");
    for(const view of ["Red driver view","Blue driver view"]){
      await page.getByRole("button",{name:view,exact:true}).click();
      // Very short landscape windows scroll; the whole square must still fit
      // below the fixed navigation, with no labels laid over playable space.
      if(size.height<500)await field.evaluate(e=>e.scrollIntoView({block:"start"}));
      else await page.evaluate(()=>window.scrollTo(0,0));
      const box=(await field.boundingBox())!,nav=(await page.getByRole("navigation",{name:"Main Navigation"}).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(nav.y+nav.height);
      expect(box.y+box.height).toBeLessThanOrEqual(size.height);
      expect(Math.abs(box.height-box.width)).toBeLessThan(1);
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);
      const totals=page.locator(".bio-field-total");await expect(totals).toHaveCount(8);
      await expect(page.getByLabel("Flower 1: 4 balls total",{exact:true})).toBeVisible();
      for(const total of await totals.all()){
        const b=(await total.boundingBox())!;
        expect(b.width).toBeLessThanOrEqual(24);expect(b.height).toBeLessThanOrEqual(24);
        expect(b.x).toBeGreaterThanOrEqual(box.x);expect(b.y).toBeGreaterThanOrEqual(box.y);
        expect(b.x+b.width).toBeLessThanOrEqual(box.x+box.width);expect(b.y+b.height).toBeLessThanOrEqual(box.y+box.height);
      }
      for(const label of await page.locator(".bio-element-label").all()){
        const b=(await label.boundingBox())!;
        expect(b.x>=box.x+box.width||b.y>=box.y+box.height||b.x+b.width<=box.x||b.y+b.height<=box.y).toBe(true);
      }
    }
    await mkdir("scratch/biobuzz",{recursive:true});
    await page.screenshot({path:`scratch/biobuzz/layout-${size.width}-${size.height}-${testInfo.project.name}.png`});
    await page.getByRole("button",{name:"Start timed match",exact:true}).click();
    await expect(page.getByTestId("nectar-countdown")).toBeVisible();
    if(size.height<500)await field.evaluate(e=>e.scrollIntoView({block:"start"}));
    else await page.evaluate(()=>window.scrollTo(0,0));
    const timedBox=(await field.boundingBox())!,nav=(await page.getByRole("navigation",{name:"Main Navigation"}).boundingBox())!;
    expect(timedBox.y).toBeGreaterThanOrEqual(nav.y+nav.height);
    expect(timedBox.y+timedBox.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:`scratch/biobuzz/layout-timed-${size.width}-${size.height}-${testInfo.project.name}.png`});
  }
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
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  await page.getByRole("region",{name:"Robot configuration",exact:true}).getByRole("checkbox",{name:"Shooter turret",exact:true}).check();
  await page.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  const before=await page.getByTestId("robot-position").innerText();
  await page.evaluate(()=>{(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD.axes[1]=-.7;});
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await page.evaluate(()=>{(window as unknown as {BIOBUZZ_TEST_PAD:Pad}).BIOBUZZ_TEST_PAD.axes[1]=0;});
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();
  await button(4,true);await expect(page.getByTestId("turret-angle")).not.toContainText("0.0°");await button(4,false);
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  await button(6,true);await expect(page.getByRole("button",{name:"Aim",exact:true})).toBeVisible();
  await button(6,false);await page.waitForTimeout(100);
  await button(6,true);await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  await page.waitForTimeout(150);await expect(page.getByTestId("inventory")).toContainText("4/4");await button(6,false);
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

test("BIOBUZZ separates Aim from Shoot and keeps intake toggled",async({page})=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await expect(page.getByRole("button",{name:"Aim",exact:true})).toBeVisible();
  const intake=page.getByRole("checkbox",{name:"Run intake",exact:true});
  const field=page.locator("canvas.bio-field");
  await field.click();
  await page.keyboard.down("j");await page.keyboard.down("j");await page.keyboard.up("j");
  await expect(intake).toBeChecked();
  const before=await page.getByTestId("robot-position").innerText();
  // Aim remains active after release without firing; Shoot is an independent edge.
  await page.getByRole("button",{name:"Aim",exact:true}).click();
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  await page.waitForTimeout(200);await expect(page.getByTestId("inventory")).toContainText("4/4");
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 4 balls",{exact:true})).toBeVisible();
  await expect(intake).toBeChecked();
  for(const count of [2,1,0]){
    await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
    await page.getByRole("button",{name:"Shoot",exact:true}).click();
    await expect(page.getByTestId("inventory")).toContainText(`${count}/4`);
  }
  await expect(page.getByText(/^red hive: 1 tips/)).toBeVisible();
  await expect(page.getByTestId("nectar-reserve-red")).toHaveText("red nectar: 4 in reserve · 0 release credits");
  await expect(page.getByTestId("hive-contents-red-1")).toContainText("Down");
  await expect(page.getByTestId("hive-contents-red-2")).toContainText("Open");
  await expect(page.getByTestId("hive-contents-red-1").getByLabel("0 red nectar",{exact:true})).toBeVisible();
  await expect(intake).toBeChecked();
  await field.click();await page.keyboard.press("j");await expect(intake).not.toBeChecked();
  await page.getByRole("button",{name:"Intake off",exact:true}).click();await expect(intake).toBeChecked();
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();await expect(intake).not.toBeChecked();
});

test("BIOBUZZ saves turret and speed settings and aims without turning the chassis",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  const form=page.getByRole("region",{name:"Robot configuration",exact:true});
  await form.getByRole("checkbox",{name:"Shooter turret",exact:true}).check();
  await form.getByLabel("Chassis speed (m/s)",{exact:true}).fill("10");
  await expect(form.getByRole("button",{name:"Apply configuration and reset",exact:true})).toBeDisabled();
  await expect(form.getByRole("alert")).toContainText("outside the supported range");
  await form.getByLabel("Chassis speed (m/s)",{exact:true}).fill("0.8");
  await form.getByLabel("Turn speed (degrees/s)",{exact:true}).fill("90");
  await form.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  await expect(page.getByTestId("robot-motion")).toHaveText("Turret: on · Chassis 0.80 m/s · Turn 90°/s");
  const heading=(await page.getByTestId("robot-position").innerText()).split(" · ").at(-1);
  // A configured turret acquires the hive by itself; Aim is only needed to toggle it.
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  expect((await page.getByTestId("robot-position").innerText()).split(" · ").at(-1)).toBe(heading);
  await expect(page.getByTestId("turret-angle")).not.toContainText("0.0°");
  await page.getByRole("button",{name:"Shoot",exact:true}).click();
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 4 balls",{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByTestId("inventory")).toContainText("3/4");
  await page.getByRole("button",{name:"Cancel aim",exact:true}).click();
  await page.getByRole("button",{name:"Turret left",exact:true}).click();
  const pose=await page.getByTestId("robot-position").innerText();
  await page.getByRole("button",{name:"Drive forward",exact:true}).click();
  await expect(page.getByTestId("robot-position")).not.toHaveText(pose);
  await mkdir("scratch/biobuzz",{recursive:true});await page.screenshot({path:`scratch/biobuzz/turret-${testInfo.project.name}.png`,fullPage:true});
  await page.reload();await expect(page.getByTestId("robot-motion")).toHaveText("Turret: on · Chassis 0.80 m/s · Turn 90°/s");
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await expect(editor.getByRole("checkbox",{name:"Shooter turret",exact:true})).toBeChecked();
  await editor.getByRole("button",{name:"Save locally",exact:true}).click();
  await editor.getByRole("checkbox",{name:"Shooter turret",exact:true}).uncheck();
  await editor.getByRole("button",{name:"Load saved",exact:true}).click();
  await expect(editor.getByRole("checkbox",{name:"Shooter turret",exact:true})).toBeChecked();
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await expect(editor.getByRole("status")).toContainText("default drive speeds");
});

test("BIOBUZZ exposes the timer, nectar rule window, and gamepad controls beside the field",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await expect(page.getByTestId("nectar-window")).toHaveText("Practice · nectar flowers open");
  await expect(page.getByText(/Standard gamepad: left stick drive/)).toContainText("left trigger aim/cancel aim · right trigger shoot");
  await page.getByRole("button",{name:"Start timed match",exact:true}).click();
  await expect(page.getByRole("timer",{name:"Match timer"})).toContainText("AUTO");
  await expect(page.getByTestId("nectar-window")).toHaveText("Nectar flowers locked");
  await expect(page.getByTestId("nectar-countdown")).toContainText("at TELEOP 1:00");
  await expect(page.getByTestId("nectar-countdown")).toContainText("20-point penalty");
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await expect(page.getByRole("timer")).toContainText("PAUSED");
  // Pause travels through the worker; wait for its final in-flight snapshot.
  await expect.poll(async()=>{const before=await page.getByRole("timer").innerText();await page.waitForTimeout(150);return before===await page.getByRole("timer").innerText();}).toBe(true);
  await page.getByRole("timer").scrollIntoViewIfNeeded();
  await mkdir("scratch/biobuzz",{recursive:true});await page.screenshot({path:`scratch/biobuzz/match-timer-${testInfo.project.name}.png`});
  await page.getByRole("button",{name:"Return to untimed practice",exact:true}).click();
  await expect(page.getByTestId("nectar-window")).toHaveText("Practice · nectar flowers open");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
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
