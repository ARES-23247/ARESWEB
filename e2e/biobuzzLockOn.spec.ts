import { expect,test } from "./fixtures";
import { mkdir } from "node:fs/promises";

test("BIOBUZZ locks while driving, toggles once per held key and repeats held scoring controls",async({page})=>{
  test.setTimeout(45000);
  await page.goto("/biobuzz/simulator");
  await page.getByRole("button",{name:"Aim off",exact:true}).click();
  const aim=page.getByRole("button",{name:"Aim on",exact:true});
  await expect(aim).toHaveAttribute("aria-pressed","true");
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  const before=await page.getByTestId("robot-position").innerText();
  await page.getByRole("button",{name:"Drive forward",exact:true}).click();
  await expect(page.getByTestId("robot-position")).not.toHaveText(before);
  await expect(aim).toHaveAttribute("aria-pressed","true");
  await expect(page.getByTestId("inventory")).toContainText("4/4");
  await page.locator("canvas.bio-field").click();await page.keyboard.down("h");
  await expect(page.getByRole("button",{name:"Aim off",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.waitForTimeout(250);await expect(page.getByRole("button",{name:"Aim off",exact:true})).toBeVisible();await page.keyboard.up("h");
  await page.waitForTimeout(60);await page.keyboard.down("h");await expect(aim).toBeVisible();await page.keyboard.up("h");
  await expect(page.getByTestId("aim-status")).toContainText("Ready to shoot");
  await page.keyboard.down("f");
  try{await expect(page.getByTestId("inventory")).toContainText("0/4");}finally{await page.keyboard.up("f");}
  await expect(page.getByText(/^red hive: 1 tips/)).toBeVisible();
  await page.getByRole("button",{name:"Reset local field",exact:true}).click();
  const placement=page.getByRole("button",{name:"Place in flower",exact:true});
  await placement.scrollIntoViewIfNeeded();const bounds=(await placement.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
  try{await expect(page.getByTestId("inventory")).toContainText("0/4");}finally{await page.mouse.up();}
  await expect(page.getByText("Flower 2: 8 pollen / 0 nectar",{exact:true})).toBeVisible();
});

test("BIOBUZZ shows configured mechanism sides and saves auto lock and intake toggles",async({page},testInfo)=>{
  await page.goto("/biobuzz/simulator");
  await page.getByRole("button",{name:"Configure robot",exact:true}).click();
  const form=page.getByRole("region",{name:"Robot configuration",exact:true});
  await form.getByLabel("Hive shooter side",{exact:true}).selectOption("back");
  await form.getByLabel("Flower placement side",{exact:true}).selectOption("front");
  await form.getByLabel("Intake side",{exact:true}).selectOption("both");
  await form.getByRole("button",{name:"Apply configuration and reset",exact:true}).click();
  const diagram=page.getByRole("figure",{name:"Robot mechanism layout"});
  await expect(diagram.getByRole("group",{name:"front mechanisms"})).toHaveText("I IntakeF Flower placement");
  await expect(diagram.getByRole("group",{name:"back mechanisms"})).toHaveText("I IntakeS Shooter");
  await mkdir("scratch/biobuzz-lock",{recursive:true});
  await diagram.screenshot({path:`scratch/biobuzz-lock/mechanisms-${testInfo.project.name}.png`});
  await page.locator("canvas.bio-field").screenshot({path:`scratch/biobuzz-lock/field-${testInfo.project.name}.png`});
  await page.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=page.getByRole("region",{name:"Auto editor",exact:true});
  await editor.getByRole("button",{name:"Add intake",exact:true}).click();
  await editor.getByRole("button",{name:"Add aim lock",exact:true}).click();
  await editor.getByRole("button",{name:"Add shot",exact:true}).click();
  await editor.getByLabel("Balls",{exact:true}).fill("2");
  await editor.getByRole("button",{name:"Add aim lock",exact:true}).click();
  await editor.getByRole("checkbox",{name:"Aim lock enabled",exact:true}).last().uncheck();
  await editor.getByRole("button",{name:"Add intake",exact:true}).click();
  await editor.getByRole("checkbox",{name:"Intake enabled",exact:true}).last().uncheck();
  await editor.getByRole("button",{name:"Save locally",exact:true}).click();
  await editor.getByRole("checkbox",{name:"Aim lock enabled",exact:true}).first().uncheck();
  await editor.getByRole("button",{name:"Load saved",exact:true}).click();
  await expect(editor.getByRole("checkbox",{name:"Aim lock enabled",exact:true}).first()).toBeChecked();
  await expect(editor.getByRole("checkbox",{name:"Aim lock enabled",exact:true}).last()).not.toBeChecked();
  await expect(editor.getByRole("checkbox",{name:"Intake enabled",exact:true}).first()).toBeChecked();
  await expect(editor.getByRole("checkbox",{name:"Intake enabled",exact:true}).last()).not.toBeChecked();
  await editor.getByRole("button",{name:"Run AUTO only",exact:true}).click();
  await expect(page.getByTestId("inventory")).toContainText("2/4",{timeout:10000});
  await expect(page.getByText("red hive: 0 tips · cell 1 open · 5 balls",{exact:true})).toBeVisible();
  await editor.getByRole("button",{name:"Export for ARES Studio",exact:true}).click();
  await expect(editor.getByRole("status")).toContainText("Studio export does not support lock-on steps");
});
