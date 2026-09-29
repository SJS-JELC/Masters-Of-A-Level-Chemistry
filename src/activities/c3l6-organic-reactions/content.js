globalThis.C3L6Content = {
  "title": "Organic reactions: classify and draw products",
  "introduction": "Classify reactions by the change in the organic molecule, then use formulae, molar masses and reaction relationships to identify products. The source notes that the classification describes what happens to the molecule, not the mechanism.",
  "assets": {
    "introGroups": {
      "src": "assets/question-image3.png",
      "alt": "Reference chart showing examples of functional groups grouped by the number of bonds from a highlighted carbon to electronegative atoms.",
      "width": 879,
      "height": 912
    },
    "introRules": {
      "src": "assets/question-image4.png",
      "alt": "Reference notes on oxidation, reduction and hydrolysis by functional-group level; the reactions shown do not break or form carbon–carbon bonds.",
      "width": 877,
      "height": 470
    },
    "introEthanol": {
      "src": "assets/question-image1.jpeg",
      "alt": "Skeletal formula example of ethanol, showing an –OH group.",
      "width": 237,
      "height": 87
    },
    "introEthanal": {
      "src": "assets/question-image2.jpeg",
      "alt": "Skeletal formula example of ethanal, showing a carbonyl group bonded to hydrogen.",
      "width": 137,
      "height": 137
    },
    "a": {
      "src": "assets/question-image5.png",
      "alt": "Ten organic reaction schemes for classification. Choose oxidation, reduction or hydrolysis for each; the image contains questions only.",
      "width": 699,
      "height": 1075
    },
    "b": {
      "src": "assets/question-image6.png",
      "alt": "Hydrolysis questions about natural products, with product labels and nominal masses to guide structure suggestions. Includes the pictured honey bee and Gyromitra fungus; no answers are shown.",
      "width": 714,
      "height": 1033
    },
    "c": {
      "src": "assets/question-image7.png",
      "alt": "Reaction network linking unknown compounds R–Z by hydrolysis, oxidation and dimerisation, with stoichiometric relationships. Draw each unknown structure.",
      "width": 745,
      "height": 960
    }
  },
  "stages": {
    "a": {
      "title": "Classify the reactions",
      "prompt": "Each reaction takes place with a single reagent. Classify each as oxidation, reduction or hydrolysis. The source states that no carbon–carbon bonds are broken or formed.",
      "answers": [
        {
          "id": "(1)",
          "label": "(i)",
          "answer": "oxidation"
        },
        {
          "id": "(2)",
          "label": "(ii)",
          "answer": "hydrolysis"
        },
        {
          "id": "(3)",
          "label": "(iii)",
          "answer": "reduction"
        },
        {
          "id": "(4)",
          "label": "(iv)",
          "answer": "hydrolysis"
        },
        {
          "id": "(5)",
          "label": "(v)",
          "answer": "hydrolysis"
        },
        {
          "id": "(6)",
          "label": "(vi)",
          "answer": "reduction"
        },
        {
          "id": "(7)",
          "label": "(vii)",
          "answer": "hydrolysis"
        },
        {
          "id": "(8)",
          "label": "(viii)",
          "answer": "reduction"
        },
        {
          "id": "(9)",
          "label": "(ix)",
          "answer": "oxidation"
        },
        {
          "id": "(10)",
          "label": "(x)",
          "answer": "hydrolysis"
        }
      ]
    },
    "b": {
      "title": "Suggest hydrolysis products",
      "prompt": "Each natural product undergoes hydrolysis to give the products shown. Suggest structures using the nominal molecular masses in brackets.",
      "labels": [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "J",
        "K",
        "L",
        "M"
      ],
      "interchangeable": [
        [
          "E",
          "F"
        ]
      ],
      "answers": [
        {
          "id": "A",
          "label": "A",
          "alternatives": [
            {
              "smiles": "O=CO",
              "formula": "CH2O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": 90.0,
                    "y": 25.981
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -0.0,
                    "y": -25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -90.0,
                    "y": 25.981
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 46
        },
        {
          "id": "B",
          "label": "B",
          "alternatives": [
            {
              "smiles": "CC(C)CO",
              "formula": "C4H10O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": 51.962
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -30.0,
                    "y": 17.321
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": -30.0,
                    "y": -51.962
                  },
                  {
                    "id": 4,
                    "element": "C",
                    "x": 30.0,
                    "y": 51.962
                  },
                  {
                    "id": 5,
                    "element": "O",
                    "x": 90.0,
                    "y": 17.321
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 74
        },
        {
          "id": "C",
          "label": "C",
          "alternatives": [
            {
              "smiles": "O=C(CCCCO)CCCCO",
              "formula": "C9H18O3",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": -90.0,
                    "y": 15.588
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -72.0,
                    "y": 5.196
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": -54.0,
                    "y": 15.588
                  },
                  {
                    "id": 4,
                    "element": "C",
                    "x": -36.0,
                    "y": 5.196
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -18.0,
                    "y": 15.588
                  },
                  {
                    "id": 6,
                    "element": "C",
                    "x": 0.0,
                    "y": 5.196
                  },
                  {
                    "id": 7,
                    "element": "O",
                    "x": 0.0,
                    "y": -15.588
                  },
                  {
                    "id": 8,
                    "element": "C",
                    "x": 18.0,
                    "y": 15.588
                  },
                  {
                    "id": 9,
                    "element": "C",
                    "x": 36.0,
                    "y": 5.196
                  },
                  {
                    "id": 10,
                    "element": "C",
                    "x": 54.0,
                    "y": 15.588
                  },
                  {
                    "id": 11,
                    "element": "C",
                    "x": 72.0,
                    "y": 5.196
                  },
                  {
                    "id": 12,
                    "element": "O",
                    "x": 90.0,
                    "y": 15.588
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 1
                  },
                  {
                    "a": 6,
                    "b": 7,
                    "order": 2
                  },
                  {
                    "a": 6,
                    "b": 8,
                    "order": 1
                  },
                  {
                    "a": 8,
                    "b": 9,
                    "order": 1
                  },
                  {
                    "a": 9,
                    "b": 10,
                    "order": 1
                  },
                  {
                    "a": 10,
                    "b": 11,
                    "order": 1
                  },
                  {
                    "a": 11,
                    "b": 12,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 174
        },
        {
          "id": "D",
          "label": "D",
          "alternatives": [
            {
              "smiles": "CC(C)=O",
              "formula": "C3H6O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": -77.942
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 0.0,
                    "y": -25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": 0.0,
                    "y": 77.942
                  },
                  {
                    "id": 4,
                    "element": "C",
                    "x": 90.0,
                    "y": -77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 58
        },
        {
          "id": "E",
          "label": "E",
          "alternatives": [
            {
              "smiles": "CNN",
              "formula": "CH6N2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": -25.981
                  },
                  {
                    "id": 2,
                    "element": "N",
                    "x": 0.0,
                    "y": 25.981
                  },
                  {
                    "id": 3,
                    "element": "N",
                    "x": 90.0,
                    "y": -25.981
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 46
        },
        {
          "id": "F",
          "label": "F",
          "alternatives": [
            {
              "smiles": "O=CO",
              "formula": "CH2O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": 90.0,
                    "y": 25.981
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -0.0,
                    "y": -25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -90.0,
                    "y": 25.981
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 46
        },
        {
          "id": "G",
          "label": "G",
          "alternatives": [
            {
              "smiles": "NC(=O)NC(NC(N)=O)C(=O)O",
              "formula": "C4H8N4O4",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "N",
                    "x": 90.0,
                    "y": -5.416
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 51.534,
                    "y": -13.386
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": 39.204,
                    "y": -50.684
                  },
                  {
                    "id": 4,
                    "element": "N",
                    "x": 25.398,
                    "y": 15.941
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -13.068,
                    "y": 7.971
                  },
                  {
                    "id": 6,
                    "element": "C",
                    "x": -39.204,
                    "y": 37.298
                  },
                  {
                    "id": 7,
                    "element": "O",
                    "x": -77.67,
                    "y": 29.327
                  },
                  {
                    "id": 8,
                    "element": "O",
                    "x": -26.873,
                    "y": 74.596
                  },
                  {
                    "id": 9,
                    "element": "N",
                    "x": -25.398,
                    "y": -29.327
                  },
                  {
                    "id": 10,
                    "element": "C",
                    "x": -63.864,
                    "y": -37.298
                  },
                  {
                    "id": 11,
                    "element": "N",
                    "x": -76.195,
                    "y": -74.596
                  },
                  {
                    "id": 12,
                    "element": "O",
                    "x": -90.0,
                    "y": -7.971
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 1
                  },
                  {
                    "a": 6,
                    "b": 7,
                    "order": 2
                  },
                  {
                    "a": 6,
                    "b": 8,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 9,
                    "order": 1
                  },
                  {
                    "a": 9,
                    "b": 10,
                    "order": 1
                  },
                  {
                    "a": 10,
                    "b": 11,
                    "order": 1
                  },
                  {
                    "a": 10,
                    "b": 12,
                    "order": 2
                  }
                ]
              }
            },
            {
              "smiles": "NC(=O)NC(=O)C(O)NC(N)=O",
              "formula": "C4H8N4O4",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "N",
                    "x": -90.0,
                    "y": -22.025
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -66.336,
                    "y": -2.838
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -71.121,
                    "y": 27.249
                  },
                  {
                    "id": 4,
                    "element": "N",
                    "x": -37.888,
                    "y": -13.738
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -14.224,
                    "y": 5.45
                  },
                  {
                    "id": 6,
                    "element": "O",
                    "x": -19.009,
                    "y": 35.537
                  },
                  {
                    "id": 7,
                    "element": "C",
                    "x": 14.224,
                    "y": -5.45
                  },
                  {
                    "id": 8,
                    "element": "O",
                    "x": 19.009,
                    "y": -35.537
                  },
                  {
                    "id": 9,
                    "element": "N",
                    "x": 37.888,
                    "y": 13.738
                  },
                  {
                    "id": 10,
                    "element": "C",
                    "x": 66.336,
                    "y": 2.838
                  },
                  {
                    "id": 11,
                    "element": "N",
                    "x": 90.0,
                    "y": 22.025
                  },
                  {
                    "id": 12,
                    "element": "O",
                    "x": 71.121,
                    "y": -27.249
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 2
                  },
                  {
                    "a": 5,
                    "b": 7,
                    "order": 1
                  },
                  {
                    "a": 7,
                    "b": 8,
                    "order": 1
                  },
                  {
                    "a": 7,
                    "b": 9,
                    "order": 1
                  },
                  {
                    "a": 9,
                    "b": 10,
                    "order": 1
                  },
                  {
                    "a": 10,
                    "b": 11,
                    "order": 1
                  },
                  {
                    "a": 10,
                    "b": 12,
                    "order": 2
                  }
                ]
              }
            }
          ],
          "mass": 176
        },
        {
          "id": "H",
          "label": "H",
          "alternatives": [
            {
              "smiles": "O=CC(=O)O",
              "formula": "C2H2O3",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": -90.0,
                    "y": -17.321
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -30.0,
                    "y": -51.962
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": 30.0,
                    "y": -17.321
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": 90.0,
                    "y": -51.962
                  },
                  {
                    "id": 5,
                    "element": "O",
                    "x": 30.0,
                    "y": 51.962
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 2
                  },
                  {
                    "a": 3,
                    "b": 5,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 74
        },
        {
          "id": "J",
          "label": "J",
          "alternatives": [
            {
              "smiles": "NC(N)=O",
              "formula": "CH4N2O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "N",
                    "x": 90.0,
                    "y": 77.942
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -0.0,
                    "y": 25.981
                  },
                  {
                    "id": 3,
                    "element": "N",
                    "x": -90.0,
                    "y": 77.942
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": -0.0,
                    "y": -77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 2
                  }
                ]
              }
            }
          ],
          "mass": 60
        },
        {
          "id": "K",
          "label": "K",
          "alternatives": [
            {
              "smiles": "O=C(O)C(O)O",
              "formula": "C2H4O4",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": -90.0,
                    "y": 77.942
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -45.0,
                    "y": 0.0
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -90.0,
                    "y": -77.942
                  },
                  {
                    "id": 4,
                    "element": "C",
                    "x": 45.0,
                    "y": -0.0
                  },
                  {
                    "id": 5,
                    "element": "O",
                    "x": 90.0,
                    "y": -77.942
                  },
                  {
                    "id": 6,
                    "element": "O",
                    "x": 90.0,
                    "y": 77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 6,
                    "order": 1
                  }
                ]
              }
            },
            {
              "smiles": "O=CC(O)(O)O",
              "formula": "C2H4O4",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": -90.0,
                    "y": 0.0
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -30.0,
                    "y": -34.641
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": 30.0,
                    "y": 0.0
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": 90.0,
                    "y": 34.641
                  },
                  {
                    "id": 5,
                    "element": "O",
                    "x": 64.641,
                    "y": -60.0
                  },
                  {
                    "id": 6,
                    "element": "O",
                    "x": -4.641,
                    "y": 60.0
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 6,
                    "order": 1
                  }
                ]
              }
            }
          ],
          "mass": 92
        },
        {
          "id": "L",
          "label": "L",
          "alternatives": [
            {
              "smiles": "O=C=O",
              "formula": "CO2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": 90.0,
                    "y": 0.0
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 0.0,
                    "y": -0.0
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -90.0,
                    "y": 0.0
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  }
                ]
              }
            }
          ],
          "mass": 44
        },
        {
          "id": "M",
          "label": "M",
          "alternatives": [
            {
              "smiles": "N",
              "formula": "H3N",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "N",
                    "x": 0.0,
                    "y": 0.0
                  }
                ],
                "bonds": []
              }
            }
          ],
          "mass": 17
        }
      ]
    },
    "c": {
      "title": "Draw the unknown compounds",
      "prompt": "Draw structures for compounds R–Z. The source hints that they contain only carbon, hydrogen and oxygen; each carbon is bonded to exactly one other carbon; no C=C or C≡C bonds occur; and a carbonyl is generally preferred to a carbon with two hydroxyl groups when both satisfy the evidence.",
      "labels": [
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z"
      ],
      "answers": [
        {
          "id": "R",
          "label": "R",
          "alternatives": [
            {
              "smiles": "CCOC(C)OCC",
              "formula": "C6H14O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -0.0,
                    "y": 77.942
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -0.0,
                    "y": 25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -45.0,
                    "y": 0.0
                  },
                  {
                    "id": 4,
                    "element": "C",
                    "x": -45.0,
                    "y": -51.962
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -90.0,
                    "y": -77.942
                  },
                  {
                    "id": 6,
                    "element": "O",
                    "x": 45.0,
                    "y": 0.0
                  },
                  {
                    "id": 7,
                    "element": "C",
                    "x": 45.0,
                    "y": -51.962
                  },
                  {
                    "id": 8,
                    "element": "C",
                    "x": 90.0,
                    "y": -77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 6,
                    "order": 1
                  },
                  {
                    "a": 6,
                    "b": 7,
                    "order": 1
                  },
                  {
                    "a": 7,
                    "b": 8,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "S",
          "label": "S",
          "alternatives": [
            {
              "smiles": "CCO",
              "formula": "C2H6O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": -25.981
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 0.0,
                    "y": 25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": 90.0,
                    "y": -25.981
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "T",
          "label": "T",
          "alternatives": [
            {
              "smiles": "CC=O",
              "formula": "C2H4O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": -25.981
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 0.0,
                    "y": 25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": 90.0,
                    "y": -25.981
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "U",
          "label": "U",
          "alternatives": [
            {
              "smiles": "CC(=O)O",
              "formula": "C2H4O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": -77.942
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 0.0,
                    "y": -25.981
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": 90.0,
                    "y": -77.942
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": 0.0,
                    "y": 77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "V",
          "label": "V",
          "alternatives": [
            {
              "smiles": "CC(=O)OC(C)=O",
              "formula": "C4H6O3",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": 38.971
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -45.0,
                    "y": 12.99
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -45.0,
                    "y": -38.971
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": -0.0,
                    "y": 38.971
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": 45.0,
                    "y": 12.99
                  },
                  {
                    "id": 6,
                    "element": "O",
                    "x": 45.0,
                    "y": -38.971
                  },
                  {
                    "id": 7,
                    "element": "C",
                    "x": 90.0,
                    "y": 38.971
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 2
                  },
                  {
                    "a": 5,
                    "b": 7,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "W",
          "label": "W",
          "alternatives": [
            {
              "smiles": "CC(=O)OCCOC(C)=O",
              "formula": "C6H10O4",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": -90.0,
                    "y": 18.432
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -65.832,
                    "y": 0.313
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -69.439,
                    "y": -29.677
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": -38.056,
                    "y": 12.184
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -13.888,
                    "y": -5.935
                  },
                  {
                    "id": 6,
                    "element": "C",
                    "x": 13.888,
                    "y": 5.935
                  },
                  {
                    "id": 7,
                    "element": "O",
                    "x": 38.056,
                    "y": -12.184
                  },
                  {
                    "id": 8,
                    "element": "C",
                    "x": 65.832,
                    "y": -0.313
                  },
                  {
                    "id": 9,
                    "element": "O",
                    "x": 69.439,
                    "y": 29.677
                  },
                  {
                    "id": 10,
                    "element": "C",
                    "x": 90.0,
                    "y": -18.432
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 2
                  },
                  {
                    "a": 2,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 1
                  },
                  {
                    "a": 6,
                    "b": 7,
                    "order": 1
                  },
                  {
                    "a": 7,
                    "b": 8,
                    "order": 1
                  },
                  {
                    "a": 8,
                    "b": 9,
                    "order": 2
                  },
                  {
                    "a": 8,
                    "b": 10,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "X",
          "label": "X",
          "alternatives": [
            {
              "smiles": "OCCO",
              "formula": "C2H6O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": 90.0,
                    "y": -6.206
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 27.25,
                    "y": 20.496
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": -27.25,
                    "y": -20.496
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": -90.0,
                    "y": 6.206
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "Y",
          "label": "Y",
          "alternatives": [
            {
              "smiles": "C1COCCO1",
              "formula": "C4H8O2",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "O",
                    "x": 90.0,
                    "y": 0.0
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": 45.0,
                    "y": -77.942
                  },
                  {
                    "id": 3,
                    "element": "C",
                    "x": -45.0,
                    "y": -77.942
                  },
                  {
                    "id": 4,
                    "element": "O",
                    "x": -90.0,
                    "y": 0.0
                  },
                  {
                    "id": 5,
                    "element": "C",
                    "x": -45.0,
                    "y": 77.942
                  },
                  {
                    "id": 6,
                    "element": "C",
                    "x": 45.0,
                    "y": 77.942
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 4,
                    "order": 1
                  },
                  {
                    "a": 4,
                    "b": 5,
                    "order": 1
                  },
                  {
                    "a": 5,
                    "b": 6,
                    "order": 1
                  },
                  {
                    "a": 6,
                    "b": 1,
                    "order": 1
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "Z",
          "label": "Z",
          "alternatives": [
            {
              "smiles": "C1CO1",
              "formula": "C2H4O",
              "graph": {
                "atoms": [
                  {
                    "id": 1,
                    "element": "C",
                    "x": 77.942,
                    "y": -0.0
                  },
                  {
                    "id": 2,
                    "element": "C",
                    "x": -77.942,
                    "y": 90.0
                  },
                  {
                    "id": 3,
                    "element": "O",
                    "x": -77.942,
                    "y": -90.0
                  }
                ],
                "bonds": [
                  {
                    "a": 1,
                    "b": 2,
                    "order": 1
                  },
                  {
                    "a": 2,
                    "b": 3,
                    "order": 1
                  },
                  {
                    "a": 3,
                    "b": 1,
                    "order": 1
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  }
};
