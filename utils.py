import logging
import math

class Section():
    # a section has left and right boundaries, and top and bottom boundaries
    def __init__(self, left, right, top, bottom, name=None):
        self.left = left
        self.right = right
        self.top = top
        self.bottom = bottom
        self.name = name
        
    def include(self, x, y):
        return self.left <= x <= self.right and self.bottom <= y <= self.top 
    
    def include_polygon(self, polygon):
        if not isinstance(polygon, Polygon):
            return False
        
        return self.left <= polygon.centroid[0] <= self.right and self.bottom <= polygon.centroid[1] <= self.top
    
    def get_name(self):
        return self.name
    
    def __str__(self):
        return f"Section: {self.name}, left={self.left}, right={self.right}, top={self.top}, bottom={self.bottom}"


class Polygon():
    def __init__(self, geoid, ppl_density, centroid, state_name, geom=None):
        self.geoid = geoid
        self.ppl_density = ppl_density
        self.centroid = centroid
        self.state_name = state_name
        self.section = None
        self.geom = geom
       
    
    def set_section(self, section: Section):
        self.section = section
        
    def __str__(self):
        return f"geoid={self.geoid}, ppl_density={self.ppl_density}, centroid={self.centroid}, state_name={self.state_name},section={self.section}, geom={self.geom}"
        
        

class Map():
    NUM_SECTIONS = 9
    FOUR_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "W", "N", "C"): "NW",
        ("N", "NE", "C", "E"): "NE",
        ("W", "SW", "C", "S"): "SW",
        ("C", "E", "S", "SE"): "SE"
    }
    
    THREE_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "N", "W"): "NW",
        ("W", "SW", "S"): "SW",
        ("N", "NE", "E"): "NE",
        ("S", "SE", "E"): "SE",
        ("NW", "W", "SW"): "W",
        ("NE", "E", "SE"): "E",
        ("NW", "N", "NE"): "N",
        ("SW", "S", "SE"): "S",
        ("NW", "C", "SE"): "left_diagonal",
        ("NE", "C", "SW"): "right_diagonal",
        ("W", "C", "E"): "horizontal",
        ("N", "C", "S"): "vertical"
    }
        
    
    TWO_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "W"): "NW",
        ("NW", "N"): "NW",
        ("N", "NE"): "NE",
        ("NE", "E"): "NE",
        ("E", "SE"): "SE",
        ("SE", "S"): "SE",
        ("S", "SW"): "SW",
        ("SW", "W"): "SW"
    }
    
    
    FOUR_SECTION_RANK_RULE = {
        "high": [1, 2, 3, 4],
        "low": [6, 7, 8, 9]
    }
    
    THREE_SECTION_RANK_RULE = {
        "high": [
            [1, 2, 3],
            [2, 3, 4]
        ],
        "low": [
            [7, 8, 9],
            [6, 7, 8]
        ]
    }
    
    TWO_SECTION_RANK_RULE = {
        "high": [
            [1, 2],
            [2, 3],
            [3, 4]
        ],
        "low": [
            [6, 7],
            [7, 8],
            [8, 9]
        ]
    }
    
    def __init__(self, min_lon, min_lat, max_lon, max_lat):
        # initialize the map that hold the boundaries of the map sections
        self.min_lon = min_lon
        self.min_lat = min_lat
        self.max_lon = max_lon
        self.max_lat = max_lat
        
        self.map_width = max_lon - min_lon
        self.map_height = max_lat - min_lat
        # print(f"Map width: {self.map_width}, Map height: {self.map_height}")
        self.cell_size = 1     # for quantization, we will use 10x10 cells
        self.map_sections = self.create_map_sections(self.map_width, self.map_height)
        # self.section_lookup = self.create_section_lookup()
                
        self.polygons = []
        
        self.section_polygons = {}
        self.section_densities = {}
        self.section_ranks = {}
        
        self.trends = {
            "NW": {}, "N": {}, "NE": {}, "W": {}, "C": {}, "E": {}, "SW": {}, "S": {}, "SE": {},
            "left_diagonal": {}, "right_diagonal": {}, "horizontal": {}, "vertical": {}
        }
    
    ###########################################################################
    ###### Create the map sections and the section lookup table ###############
    ###########################################################################
    def create_map_sections(self, map_width, map_height) -> list:
        # divide the map into 9 sections, split into 3 columns and 3 rows
        map_sections = []
        # section_names = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"]
        section_names = ["SW", "S", "SE", "W", "C", "E", "NW", "N", "NE"]
        for i in range(3): 
            for j in range(3):
                left = self.min_lon + j * map_width / 3
                right = left + map_width / 3
                bottom = self.min_lat + i * map_height / 3
                top = bottom + map_height / 3
                section_name = section_names[i * 3 + j]
                
                section = Section(left, right, top, bottom, section_name)
                map_sections.append(section)

        return map_sections
    
    ###########################################################################
    ####### Remove the speedup functions and use the original ones ############
    ###########################################################################
    # def get_section_by_boundary_checks(self, x, y):
    #     for section in self.map_sections:
    #         if section.include(x, y):
    #             return section
        
    #     logging.error(f"Error: get_section_by_boundary_checks: x={x}, y={y}")
    #     return None
    
    # def create_section_lookup(self):
    #     section_lookup = {}
        
    #     # Calculate the number of cells across the width and height
    #     num_cells_width = math.ceil(self.map_width / self.cell_size)
    #     num_cells_height = math.ceil(self.map_height / self.cell_size)

    #     # Iterate over each cell in the grid
    #     for i in range(num_cells_width):
    #         for j in range(num_cells_height):
    #             # Calculate the actual x, y coordinates for the current cell
    #             x = i * self.cell_size
    #             y = j * self.cell_size

    #             # Get the section by boundary checks
    #             section = self.get_section_by_boundary_checks(x, y)
                
    #             # Map the cell indices to the section name
    #             if section:
    #                 section_lookup[(i, j)] = section.get_name()
    #             else:
    #                 logging.error(f"Error: create_section_lookup: x={x}, y={y}")
        
    #     return section_lookup
    
    # def get_section(self, x, y):
    #     # Use the quantized coordinates to lookup the section
    #     quantized_x = x // self.cell_size
    #     quantized_y = y // self.cell_size
    #     return self.section_lookup.get((quantized_x, quantized_y))
    ####### Remove the speedup functions and use the original ones ############
    ###########################################################################
    
    ###########################################################################
    ######### Given one polygon, check which section it belongs to ############
    ###########################################################################
    def get_section(self, x, y):
        for section in self.map_sections:
            if section.include(x, y):        
                return section.get_name()
        # logging.error(f"xd: {self.min_lon}, min_lat: {self.max_lon}, max_lon: {self.min_lat}, max_lat: {self.max_lat}")
        # logging.error(f"Error: get_section_by_boundary_checks: x={x}, y={y}")
        return None
    
    def get_section_by_centroid(self, polygon):
        x = polygon.centroid[0]
        y = polygon.centroid[1]
        return self.get_section(x, y)
    
    ##############################################################################
    #### Given a list of polygons, check which section each polygon belongs to ###
    ##############################################################################
    def set_polygons(self, polygons):
        self.polygons = polygons
        self.section_polygons = self.assign_polygons_to_sections()
        
        
    def assign_polygons_to_sections(self):
        section_polygons = {section.get_name(): [] for section in self.map_sections}

        for polygon in self.polygons:
            section_name = self.get_section_by_centroid(polygon)
            
            if section_name:
                polygon.set_section(section_name)
                section_polygons[section_name].append(polygon)
            # else:
                # logging.error(f"Polygon with centroid ({polygon.centroid[0]}, {polygon.centroid[1]}) is out of map bounds.")

        return section_polygons
    
    ##############################################################################
    ######## Calculate the average population density for each section ###########
    ##############################################################################
    def calculate_section_densities(self):
        if not self.section_polygons:
            self.section_polygons = self.assign_polygons_to_sections()
            
        section_densities = {}

        for section, polygons in self.section_polygons.items():
            if polygons:
                avg_density = sum(p.ppl_density for p in polygons) / len(polygons)
            else:
                avg_density = 0
            section_densities[section] = avg_density

        self.section_densities = section_densities
        
        
    ##############################################################################
    ######## Rank the sections by population density #############################
    ##############################################################################
    def rank_sections(self):
        if not self.section_densities:
            self.calculate_section_densities()

        # Sort the sections by density
        sorted_sections = sorted(self.section_densities.items(), key=lambda x: x[1], reverse=True)
        
        # Assign ranks to the sections
        ranked_sections = [(section, rank + 1) for rank, (section, density) in enumerate(sorted_sections)]
        
        self.section_ranks = dict(ranked_sections)
    
    def find_high_density_clusters(self):
        if not self.section_ranks:
            self.section_ranks = self.rank_sections()
            
        def is_added(area):
            for temp_trend, _ in self.trends.items():
                if (area in temp_trend or temp_trend in area) and len(_) > 0:
                    return True
            return False
        
            
        # check the four section trend first
        for bounding_box, area in self.FOUR_SECTION_TREND_BOUNDING_BOX.items():
            if area not in self.trends and len(self.trends[area]) > 0:
                continue

            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trend = sorted(temp_trends)
            if temp_trend == self.FOUR_SECTION_RANK_RULE["high"]:
                self.trends[area]["high"] = bounding_box
            elif temp_trend == self.FOUR_SECTION_RANK_RULE["low"]:
                self.trends[area]["low"] = bounding_box

        # check the three section trend
        for bounding_box, area in self.THREE_SECTION_TREND_BOUNDING_BOX.items():
            if area not in self.trends and len(self.trends[area]) > 0:
                continue

            if is_added(area):
                continue
            
            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trends = sorted(temp_trends)
            
            if any(temp_trends == high_trend for high_trend in self.THREE_SECTION_RANK_RULE["high"]):
                if not is_added(area):
                    self.trends[area]["high"] = bounding_box
            elif any(temp_trends == low_trend for low_trend in self.THREE_SECTION_RANK_RULE["low"]):
                if not is_added(area):
                    self.trends[area]["low"] = bounding_box
                
        for bounding_box, area in self.TWO_SECTION_TREND_BOUNDING_BOX.items():
            if area not in self.trends and len(self.trends[area]) > 0:
                continue

            if is_added(area):
                continue
            
            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trends = sorted(temp_trends)
            
            if any(temp_trends == high_trend for high_trend in self.TWO_SECTION_RANK_RULE["high"]):
                if not is_added(area):
                    self.trends[area]["high"] = bounding_box
            elif any(temp_trends == low_trend for low_trend in self.TWO_SECTION_RANK_RULE["low"]):
                if not is_added(area):
                    self.trends[area]["low"] = bounding_box
    
    ##############################################################################
    ######## Calculate the average population density for each section ###########
    ##############################################################################
    def calculate_mean(self):
        # calculate the mean of the section_densities
        return sum(self.section_densities.values()) / len(self.section_densities)
    
    def calculate_median(self):
        densities = [p.ppl_density for p in self.polygons]
        return sorted(densities)[len(densities) // 2]
    
    def find_min(self):
        # return the polygon with the minimum population density
        min_polygon = min(self.polygons, key=lambda p: p.ppl_density)
        return {
            "geoid": min_polygon.geoid,
            "ppl_densit": min_polygon.ppl_density,
            "geom": min_polygon.geom,
            "centroid": min_polygon.centroid,
            "section": min_polygon.section,
            "state_name": min_polygon.state_name
        }
    
    def find_max(self):
        # return the polygon with the maximum population density
        max_polygon = max(self.polygons, key=lambda p: p.ppl_density)
        return {
            "geoid": max_polygon.geoid,
            "ppl_densit": max_polygon.ppl_density,
            "geom": max_polygon.geom,
            "centroid": max_polygon.centroid,
            "section": max_polygon.section,
            "state_name": max_polygon.state_name
        }
        
        
    
            
            
        

# # Create a map object and test functions
# map = Map(100, 100)

# # Test the map object
# print("Test the map object")
# print(map.get_section(0, 0))  # NW
# print(map.get_section(50.01, 50))  # C
# print(map.get_section(99, 99))  # SE:

# # Create a list of polygons
# polygons = [
#     Polygon("1", 100000, (1, 1)),
#     Polygon("1.1", 2, (2, 2)),
#     Polygon("1.2", 3, (3, 3)),
#     Polygon("1.3", 4, (4, 4)),
#     Polygon("2", 300, (35, 20)),
#     Polygon("3", 100, (35, 50)),
#     Polygon("4", 49, (0, 62)),
#     # Polygon("5", 20000, (70, 70)),
#     # Polygon("6", 15000, (50, 50)),
# ]

# # Set the polygons to the map
# map.set_polygons(polygons)

# # Test where the polygons are assigned
# print("Test where the polygons are assigned")
# for section, polygons in map.section_polygons.items():
#     print(f"Section: {section}")
#     for polygon in polygons:
#         print(polygon) 
#   # {'NW': [1, 1.1, 1.2, 1.3], 'N': [2], 'NE': [3], 'W': [], 'C': [4], 'E': [5], 'SW': [6], 'S': [7], 'SE': [8, 9]}

# # Test the map object
# # print(map.section_polygons)
# map.calculate_section_densities()
# map.rank_sections()
# map.find_high_density_clusters()


# print(map.section_densities)
# print(map.section_ranks)
# print(map.trends)

# # requirements:
# # given one polygon, check which section it belongs to
# # given a list of polygons, check which section each polygon belongs to
# # given a list of polygons, calculate the average population density for each section
# # now rank the sections by population density
# # now I have the rank for each section, 

# -131.8021562500005,24.590508519208925,-65.35684375000055,52.31077689140619