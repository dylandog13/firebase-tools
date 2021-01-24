import { expect } from "chai";
import * as sinon from "sinon";

import * as helper from "../functionsDeployHelper";
import * as prompt from "../prompt";
import { FirebaseError } from "../error";

describe("functionsDeployHelper", () => {
  describe("getFilterGroups", () => {
    it("should parse multiple filters", () => {
      const options = {
        only: "functions:myFunc,functions:myOtherFunc",
      };
      expect(helper.getFilterGroups(options)).to.deep.equal([["myFunc"], ["myOtherFunc"]]);
    });
    it("should parse nested filters", () => {
      const options = {
        only: "functions:groupA.myFunc",
      };
      expect(helper.getFilterGroups(options)).to.deep.equal([["groupA", "myFunc"]]);
    });
  });

  describe("getReleaseNames", () => {
    it("should handle function update", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle function deletion", () => {
      const uploadNames: string[] = [];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle function creation", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames: string[] = [];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle existing function not being in filter", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc2"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myFunc",
      ]);
    });

    it("should handle no functions satisfying filter", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myFunc2"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myFunc3"];
      const filter = [["myFunc"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([]);
    });

    it("should handle entire function groups", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myGroup-func1"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myGroup-func2"];
      const filter = [["myGroup"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myGroup-func1",
        "projects/myProject/locations/us-central1/functions/myGroup-func2",
      ]);
    });

    it("should handle functions within groups", () => {
      const uploadNames = ["projects/myProject/locations/us-central1/functions/myGroup-func1"];
      const existingNames = ["projects/myProject/locations/us-central1/functions/myGroup-func2"];
      const filter = [["myGroup", "func1"]];

      expect(helper.getReleaseNames(uploadNames, existingNames, filter)).to.deep.equal([
        "projects/myProject/locations/us-central1/functions/myGroup-func1",
      ]);
    });
  });

  describe("createFunctionRegionMap", () => {
    it("should handle default region", () => {
      const triggers = [
        {
          name: "myFunc",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
        {
          name: "myOtherFunc",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];

      expect(helper.createFunctionRegionMap("myProject", triggers)).to.deep.equal({
        "us-central1": [
          {
            name: "projects/myProject/locations/us-central1/functions/myFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
          {
            name: "projects/myProject/locations/us-central1/functions/myOtherFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
      });
    });

    it("should handle customized region", () => {
      const triggers = [
        {
          name: "myFunc",
          regions: ["us-east1"],
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
        {
          name: "myOtherFunc",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];

      expect(helper.createFunctionRegionMap("myProject", triggers)).to.deep.equal({
        "us-east1": [
          {
            name: "projects/myProject/locations/us-east1/functions/myFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        "us-central1": [
          {
            name: "projects/myProject/locations/us-central1/functions/myOtherFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
      });
    });

    it("should handle multiple customized region for a function", () => {
      const triggers = [
        {
          name: "myFunc",
          regions: ["us-east1", "eu-west1"],
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];

      expect(helper.createFunctionRegionMap("myProject", triggers)).to.deep.equal({
        "eu-west1": [
          {
            name: "projects/myProject/locations/eu-west1/functions/myFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        "us-east1": [
          {
            name: "projects/myProject/locations/us-east1/functions/myFunc",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
      });
    });
  });

  describe("promptForFailurePolicies", () => {
    let promptStub: sinon.SinonStub;

    beforeEach(() => {
      promptStub = sinon.stub(prompt, "promptOnce");
    });

    afterEach(() => {
      promptStub.restore();
    });

    it("should prompt if there are any functions with failure policies", () => {
      const funcs: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/b/functions/c",
          entryPoint: "",
          labels: {},
          environmentVariables: {},
          failurePolicy: {},
        },
      ];
      const options = {};
      promptStub.resolves(true);

      expect(async () => await helper.promptForFailurePolicies(options, funcs)).not.to.throw();
      expect(promptStub).to.have.been.calledOnce;
    });

    it("should throw if there are any functions with failure policies and the user doesn't accept the prompt", async () => {
      const funcs: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/b/functions/c",
          entryPoint: "",
          labels: {},
          environmentVariables: {},
          failurePolicy: {},
        },
      ];
      const options = {};
      promptStub.resolves(false);

      await expect(helper.promptForFailurePolicies(options, funcs)).to.be.rejectedWith(
        FirebaseError,
        /Deployment canceled/
      );
      expect(promptStub).to.have.been.calledOnce;
    });

    it("should not prompt if there are no functions with failure policies", () => {
      const funcs: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/b/functions/c",
          entryPoint: "",
          labels: {},
          environmentVariables: {},
        },
      ];
      const options = {};
      promptStub.resolves();

      expect(async () => await helper.promptForFailurePolicies(options, funcs)).not.to.throw();
      expect(promptStub).not.to.have.been.called;
    });

    it("should throw if there are any functions with failure policies, in noninteractive mode, without the force flag set", async () => {
      const funcs: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/b/functions/c",
          entryPoint: "",
          labels: {},
          environmentVariables: {},
          failurePolicy: {},
        },
      ];
      const options = { nonInteractive: true };

      await expect(helper.promptForFailurePolicies(options, funcs)).to.be.rejectedWith(
        FirebaseError,
        /--force option/
      );
      expect(promptStub).not.to.have.been.called;
    });

    it("should not throw if there are any functions with failure policies, in noninteractive mode, with the force flag set", () => {
      const funcs: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/b/functions/c",
          entryPoint: "",
          labels: {},
          environmentVariables: {},
          failurePolicy: {},
        },
      ];
      const options = { nonInteractive: true, force: true };

      expect(async () => await helper.promptForFailurePolicies(options, funcs)).not.to.throw();
      expect(promptStub).not.to.have.been.called;
    });
  });

  describe("createRegionalDeployment", () => {
    const region = "us-east1";
    it("should put new functions into functionsToCreate", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/c",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];
      const existingFunctionNames: string[] = [];
      const existingScheduledFunctionNames: string[] = [];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [
          {
            name: "projects/a/locations/us-east1/functions/c",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        functionsToUpdate: [],
        functionsToDelete: [],
        schedulesToCreateOrUpdate: [],
        schedulesToDelete: [],
      });
    });

    it("should put exisitng functions into functionsToUpdate", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/c",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];
      const existingFunctionNames: string[] = [
        "projects/a/locations/us-east1/functions/c",
        "projects/a/locations/us-east1/functions/d",
      ];
      const existingScheduledFunctionNames: string[] = [];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [],
        functionsToUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/c",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        functionsToDelete: [],
        schedulesToCreateOrUpdate: [],
        schedulesToDelete: [],
      });
    });

    it("should put exisitng functions not in local functions into functionsToDelete", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];
      const existingFunctionNames: string[] = [
        "projects/a/locations/us-east1/functions/c",
        "projects/a/locations/us-east1/functions/d",
      ];
      const existingScheduledFunctionNames: string[] = [];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [],
        functionsToUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        functionsToDelete: ["projects/a/locations/us-east1/functions/c"],
        schedulesToCreateOrUpdate: [],
        schedulesToDelete: [],
      });
    });

    it("should put newly scheduled functions into schedulesToCreateOrUpdate", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
          schedule: { schedule: "every 5 minutes" },
        },
      ];
      const existingFunctionNames: string[] = ["projects/a/locations/us-east1/functions/d"];
      const existingScheduledFunctionNames: string[] = [];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [],
        functionsToUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
            schedule: { schedule: "every 5 minutes" },
          },
        ],
        functionsToDelete: [],
        schedulesToCreateOrUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
            schedule: { schedule: "every 5 minutes" },
          },
        ],
        schedulesToDelete: [],
      });
    });

    it("should put new functions that are scheduled functions into schedulesToCreateOrUpdate", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
          schedule: { schedule: "every 5 minutes" },
        },
      ];
      const existingFunctionNames: string[] = [];
      const existingScheduledFunctionNames: string[] = [];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
            schedule: { schedule: "every 5 minutes" },
          },
        ],
        functionsToUpdate: [],
        functionsToDelete: [],
        schedulesToCreateOrUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
            schedule: { schedule: "every 5 minutes" },
          },
        ],
        schedulesToDelete: [],
      });
    });

    it("should put functions that are no longer scheduled functions into schedulesToDelete", () => {
      const localFns: helper.CloudFunctionTrigger[] = [
        {
          name: "projects/a/locations/us-east1/functions/d",
          labels: {},
          environmentVariables: {},
          entryPoint: "",
        },
      ];
      const existingFunctionNames = ["projects/a/locations/us-east1/functions/d"];
      const existingScheduledFunctionNames = ["projects/a/locations/us-east1/functions/d"];
      const filters: string[][] = [];

      const regionalDeployment = helper.createRegionalDeployment(
        region,
        localFns,
        existingFunctionNames,
        existingScheduledFunctionNames,
        filters
      );

      expect(regionalDeployment).to.deep.equal({
        region,
        functionsToCreate: [],
        functionsToUpdate: [
          {
            name: "projects/a/locations/us-east1/functions/d",
            labels: {},
            environmentVariables: {},
            entryPoint: "",
          },
        ],
        functionsToDelete: [],
        schedulesToCreateOrUpdate: [],
        schedulesToDelete: ["projects/a/locations/us-east1/functions/d"],
      });
    });
  });
});